fn main() {
    println!("cargo:rerun-if-changed=native/title.m");
    let out = std::env::var("OUT_DIR").unwrap();
    let object = format!("{out}/title.o");
    assert!(std::process::Command::new("clang").args(["-fobjc-arc", "-mmacosx-version-min=12.0", "-c", "native/title.m", "-o", &object]).status().unwrap().success());
    assert!(std::process::Command::new("ar").args(["crs", &format!("{out}/libdocument_title.a"), &object]).status().unwrap().success());
    println!("cargo:rustc-link-search=native={out}");
    println!("cargo:rustc-link-lib=static=document_title");
    println!("cargo:rustc-link-lib=framework=Cocoa");
    println!("cargo:rerun-if-changed=native/ipic.m");
    let ipic_object = format!("{out}/ipic.o");
    assert!(std::process::Command::new("clang").args(["-fobjc-arc", "-mmacosx-version-min=12.0", "-c", "native/ipic.m", "-o", &ipic_object]).status().unwrap().success());
    assert!(std::process::Command::new("ar").args(["crs", &format!("{out}/libipic.a"), &ipic_object]).status().unwrap().success());
    println!("cargo:rustc-link-lib=static=ipic");
    tauri_build::build()
}
