use chrono::Utc;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::time::Duration;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageConfig {
    provider: String,
    bucket: String,
    region: String,
    public_url: String,
    prefix: String,
}

#[derive(Serialize, Deserialize)]
struct Credentials { access_key: String, secret_key: String }

fn credential_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new("com.size.md", "image-upload").map_err(|_| "无法访问系统钥匙串。".into())
}

#[tauri::command]
pub async fn save_credentials(access_key: String, secret_key: String) -> Result<(), String> {
    if access_key.is_empty() || secret_key.is_empty() { return Err("请填写完整的上传凭据。".into()); }
    let serialized = serde_json::to_string(&Credentials { access_key, secret_key }).map_err(|_| "凭据编码失败。")?;
    credential_entry()?.set_password(&serialized).map_err(|_| "钥匙串保存失败，请允许系统钥匙串访问。".into())
}

fn hmac256(key: &[u8], message: &str) -> Vec<u8> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC accepts arbitrary key length");
    mac.update(message.as_bytes()); mac.finalize().into_bytes().to_vec()
}
fn hmac1(key: &[u8], message: &str) -> String {
    let mut mac = Hmac::<Sha1>::new_from_slice(key).expect("HMAC accepts arbitrary key length");
    mac.update(message.as_bytes()); hex::encode(mac.finalize().into_bytes())
}
fn oss_sign(secret: &str, region: &str, timestamp: &str, canonical: &str) -> String {
    let date = &timestamp[..8];
    let scope = format!("{date}/{region}/oss/aliyun_v4_request");
    let key = hmac256(format!("aliyun_v4{secret}").as_bytes(), date);
    let key = hmac256(&key, region);
    let key = hmac256(&key, "oss");
    let key = hmac256(&key, "aliyun_v4_request");
    let to_sign = format!("OSS4-HMAC-SHA256\n{timestamp}\n{scope}\n{}", hex::encode(Sha256::digest(canonical.as_bytes())));
    hex::encode(hmac256(&key, &to_sign))
}

fn validate(config: &StorageConfig) -> Result<(), String> {
    for field in [&config.bucket, &config.region] {
        if field.is_empty() || !field.bytes().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-') {
            return Err("Bucket 和区域只能包含小写字母、数字和连字符。".into());
        }
    }
    if config.provider != "oss" && config.provider != "cos" { return Err("不支持的存储服务。".into()); }
    if !config.prefix.bytes().all(|c| c.is_ascii_alphanumeric() || b"/-_".contains(&c)) {
        return Err("目录前缀仅支持英文字母、数字、斜线、下划线和连字符。".into());
    }
    let url = reqwest::Url::parse(&config.public_url).map_err(|_| "图片访问域名无效。")?;
    if url.scheme() != "https" || url.host_str().is_none() || url.query().is_some() || url.fragment().is_some() || !url.username().is_empty() || url.password().is_some() {
        return Err("请使用无签名参数的 HTTPS 图片访问域名。".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn upload_image(data: Vec<u8>, mime: String, config: StorageConfig) -> Result<String, String> {
    validate(&config)?;
    if data.is_empty() || data.len() > 15 * 1024 * 1024 { return Err("图片大小应在 1 字节至 15 MB 之间。".into()); }
    let extension = match mime.as_str() { "image/png" => "png", "image/jpeg" => "jpg", "image/webp" => "webp", "image/gif" => "gif", _ => return Err("仅支持 PNG、JPEG、WebP、GIF。".into()) };
    let credentials: Credentials = serde_json::from_str(&credential_entry()?.get_password().map_err(|_| "请先在图片设置中保存上传密钥。")?).map_err(|_| "已保存的凭据无效，请重新设置。")?;
    let now = Utc::now();
    // Content addressing makes retries idempotent without persisting any image bytes.
    let hash = hex::encode(Sha256::digest(&data));
    let key = format!("{}/{}.{}", config.prefix.trim_matches('/'), hash, extension).trim_start_matches('/').to_owned();
    let host = if config.provider == "oss" { format!("{}.oss-{}.aliyuncs.com", config.bucket, config.region) } else { format!("{}.cos.{}.myqcloud.com", config.bucket, config.region) };
    let client = reqwest::Client::builder().timeout(Duration::from_secs(90)).redirect(reqwest::redirect::Policy::none()).build().map_err(|_| "无法创建上传连接。")?;
    let mut request = client.put(format!("https://{host}/{key}")).header("Content-Type", &mime);
    if config.provider == "oss" {
        let timestamp = now.format("%Y%m%dT%H%M%SZ").to_string();
        let date = now.format("%Y%m%d").to_string();
        let canonical = format!("PUT\n/{}/{key}\n\ncontent-type:{mime}\nx-oss-content-sha256:UNSIGNED-PAYLOAD\nx-oss-date:{timestamp}\n\n\nUNSIGNED-PAYLOAD", config.bucket);
        let signature = oss_sign(&credentials.secret_key, &config.region, &timestamp, &canonical);
        let auth = format!("OSS4-HMAC-SHA256 Credential={}/{date}/{}/oss/aliyun_v4_request, Signature={signature}", credentials.access_key, config.region);
        request = request.header("x-oss-date", timestamp).header("x-oss-content-sha256", "UNSIGNED-PAYLOAD").header("Authorization", auth);
    } else {
        let key_time = format!("{};{}", now.timestamp() - 60, now.timestamp() + 900);
        let sign_key = hmac1(credentials.secret_key.as_bytes(), &key_time);
        let http_string = format!("put\n/{key}\n\nhost={host}\n");
        let to_sign = format!("sha1\n{key_time}\n{}\n", hex::encode(Sha1::digest(http_string.as_bytes())));
        let signature = hmac1(sign_key.as_bytes(), &to_sign);
        let auth = format!("q-sign-algorithm=sha1&q-ak={}&q-sign-time={key_time}&q-key-time={key_time}&q-header-list=host&q-url-param-list=&q-signature={signature}", credentials.access_key);
        request = request.header("Authorization", auth);
    }
    let response = request.body(data).send().await.map_err(|_| "上传连接失败或超时，请检查网络后重试。")?;
    if !response.status().is_success() {
        // Do not surface provider response bodies: they may contain authorization details.
        return Err(format!("上传失败（HTTP {}），请检查区域、密钥和 Bucket 写入权限。", response.status().as_u16()));
    }
    Ok(format!("{}/{key}", config.public_url.trim_end_matches('/')))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn oss_v4_matches_documented_canonical_hash_and_sdk_derivation() {
        let canonical = "PUT\n/examplebucket/exampleobject\n\ncontent-disposition:attachment\ncontent-length:3\ncontent-md5:ICy5YqxZB1uWSwcVLSNLcA==\ncontent-type:text/plain\nx-oss-content-sha256:UNSIGNED-PAYLOAD\nx-oss-date:20250411T064124Z\n\ncontent-disposition;content-length\nUNSIGNED-PAYLOAD";
        assert_eq!(hex::encode(Sha256::digest(canonical.as_bytes())), "c46d96390bdbc2d739ac9363293ae9d710b14e48081fcb22cd8ad54b63136eca");
        // The documentation's final signature uses an illustrative/redacted secret.
        // This deterministic vector uses the literal "yourAccessKeySecret", verified
        // independently with Python hmac and the official SignerV4 derivation.
        assert_eq!(oss_sign("yourAccessKeySecret", "cn-hangzhou", "20250411T064124Z", canonical), "d3694c2dfc5371ee6acd35e88c4871ac95a7ba01d3a2f476768fe61218590097");
    }
    #[test]
    fn rejects_untrusted_hosts_and_expiring_urls() {
        let mut c = StorageConfig { provider: "oss".into(), bucket: "bucket".into(), region: "cn-hangzhou".into(), public_url: "https://img.example.com".into(), prefix: "size-md".into() };
        assert!(validate(&c).is_ok());
        c.bucket = "bucket@evil.example/".into(); assert!(validate(&c).is_err());
        c.bucket = "bucket".into(); c.public_url += "?signature=expiring"; assert!(validate(&c).is_err());
    }
}
