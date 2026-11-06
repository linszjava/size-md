#import <Cocoa/Cocoa.h>
// Implements the public protocol documented by toolinbox/iPicUploader.
// Uses iPic's named pasteboard, never the user's general clipboard or a temporary image file.
@interface SizeIPicImage : NSObject <NSCoding>
@property NSString *identifier;
@property NSData *data;
@end
@implementation SizeIPicImage
- (void)encodeWithCoder:(NSCoder *)coder {
    [coder encodeObject:self.identifier forKey:@"id"];
    [coder encodeObject:self.data forKey:@"imageData"];
    [coder encodeObject:nil forKey:@"imageFilePath"];
    [coder encodeInteger:1 forKey:@"version"];
    [coder encodeObject:nil forKey:@"json"];
}
- (instancetype)initWithCoder:(NSCoder *)coder { return [super init]; }
@end
@interface SizeIPicResult : NSObject <NSSecureCoding>
@property NSString *identifier;
@property NSString *link;
@property NSError *error;
@end
@implementation SizeIPicResult
+ (BOOL)supportsSecureCoding { return YES; }
- (void)encodeWithCoder:(NSCoder *)coder {}
- (instancetype)initWithCoder:(NSCoder *)coder {
    if ((self = [super init])) {
        _identifier = [coder decodeObjectOfClass:NSString.class forKey:@"id"];
        _link = [coder decodeObjectOfClass:NSString.class forKey:@"imageLink"];
        _error = [coder decodeObjectOfClass:NSError.class forKey:@"error"];
    }
    return self;
}
@end
static char *response(NSString *url, NSString *error) {
    NSData *json = [NSJSONSerialization dataWithJSONObject:error ? @{@"error":error} : @{@"url":url ?: @""} options:0 error:nil];
    return strdup([[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding].UTF8String);
}
static NSString *type(NSString *suffix) { return [@"net.toolinbox.ipic.pasteboard." stringByAppendingString:suffix]; }
char *size_ipic(const unsigned char *bytes, size_t length, bool checkOnly) {
 @autoreleasepool { @try {
    NSURL *app = [NSWorkspace.sharedWorkspace URLForApplicationWithBundleIdentifier:@"net.toolinbox.ipic"];
    if (!app) return response(nil, @"未安装 iPic。请先安装 iPic，并在其中配置图片上传服务。");
    if (checkOnly) return response(@"已检测到 iPic。请在 iPic 中选择图床，再点击验证图片上传。", nil);
    NSData *imageData = [NSData dataWithBytes:bytes length:length];
    if (![[NSImage alloc] initWithData:imageData]) return response(nil, @"图片数据无效，无法交给 iPic 上传。");
    if ([NSRunningApplication runningApplicationsWithBundleIdentifier:@"net.toolinbox.ipic"].count == 0) {
        dispatch_semaphore_t launched = dispatch_semaphore_create(0);
        __block NSError *launchError = nil;
        dispatch_async(dispatch_get_main_queue(), ^{
            NSWorkspaceOpenConfiguration *config = NSWorkspaceOpenConfiguration.configuration;
            config.activates = NO;
            [NSWorkspace.sharedWorkspace openApplicationAtURL:app configuration:config completionHandler:^(NSRunningApplication *running, NSError *error) { launchError = error; dispatch_semaphore_signal(launched); }];
        });
        if (dispatch_semaphore_wait(launched, dispatch_time(DISPATCH_TIME_NOW, 10 * NSEC_PER_SEC)) || launchError) return response(nil, @"无法启动 iPic，请手动打开后重试。");
    }
    NSPasteboard *board = [NSPasteboard pasteboardWithName:@"net.toolinbox.ipic.pasteboard"];
    [board clearContents];
    [board setString:@"" forType:type(@"iPicUploaderVersion")];
    NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:8];
    NSInteger version = 0;
    while ([deadline timeIntervalSinceNow] > 0) {
        version = [[board stringForType:type(@"iPicUploaderVersionResult")] integerValue];
        if (version >= 1) break;
        [NSThread sleepForTimeInterval:0.15];
    }
    if (version < 1) return response(nil, @"iPic 未响应上传接口。请打开或更新 iPic 后重试。");
    SizeIPicImage *image = [SizeIPicImage new]; image.identifier = NSUUID.UUID.UUIDString; image.data = imageData;
    NSKeyedArchiver *encoder = [[NSKeyedArchiver alloc] initRequiringSecureCoding:NO];
    [encoder setClassName:@"net.toolinbox.iPic.iPicImage" forClass:SizeIPicImage.class];
    [encoder encodeObject:image forKey:NSKeyedArchiveRootObjectKey]; [encoder finishEncoding];
    [board clearContents]; [board setData:encoder.encodedData forType:type(@"iPicImage")];
    NSInteger change = board.changeCount;
    deadline = [NSDate dateWithTimeIntervalSinceNow:120];
    while ([deadline timeIntervalSinceNow] > 0) {
        [NSThread sleepForTimeInterval:0.2];
        if (change == board.changeCount) continue;
        change = board.changeCount;
        NSData *resultData = [board dataForType:type(@"iPicUploadResult")];
        if (!resultData) continue;
        NSError *decodeError = nil;
        NSKeyedUnarchiver *decoder = [[NSKeyedUnarchiver alloc] initForReadingFromData:resultData error:&decodeError];
        decoder.requiresSecureCoding = YES;
        [decoder setClass:SizeIPicResult.class forClassName:@"net.toolinbox.iPic.iPicUploadResult"];
        SizeIPicResult *result = [decoder decodeObjectOfClass:SizeIPicResult.class forKey:NSKeyedArchiveRootObjectKey];
        [decoder finishDecoding];
        if (![result.identifier isEqualToString:image.identifier]) continue;
        if (result.error) return response(nil, [NSString stringWithFormat:@"iPic 上传失败（%ld）。请检查 iPic 中的图床配置与网络。", (long)result.error.code]);
        NSURLComponents *url = [NSURLComponents componentsWithString:result.link];
        if (![@[@"https",@"http"] containsObject:url.scheme.lowercaseString] || !url.host.length || url.user || url.password) return response(nil, @"iPic 未返回有效的图片网址，请检查图床设置。");
        return response(result.link, nil);
    }
    return response(nil, @"iPic 上传超时。请检查上传记录后重试，文章尚未插入图片。");
 } @catch (NSException *exception) { return response(nil, @"无法读取 iPic 的上传结果，请更新 iPic 后重试。"); } }
}
void size_ipic_free(char *value) { free(value); }
