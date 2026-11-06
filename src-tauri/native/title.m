#import <Cocoa/Cocoa.h>
typedef void (*TitleCallback)(const char *);
@interface DocumentPopover : NSViewController <NSPopoverDelegate, NSTextFieldDelegate>
@property NSPopover *popover;
@property NSTextField *nameField;
@property NSString *documentId;
@property NSString *originalName;
@property TitleCallback callback;
@property BOOL cancelled;
@property BOOL sent;
@end
static DocumentPopover *activeTitle;
static NSView *findEditorView(NSView *view) {
    if ([view isKindOfClass:NSClassFromString(@"WKWebView")]) return view;
    for (NSView *child in view.subviews) { NSView *found = findEditorView(child); if (found) return found; }
    return nil;
}
@implementation DocumentPopover
- (void)send:(NSString *)action {
    if (self.sent || self.cancelled) return;
    self.sent = YES;
    NSDictionary *value = @{ @"id": self.documentId, @"name": self.nameField.stringValue, @"action": action };
    NSData *json = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
    NSString *text = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
    self.callback(text.UTF8String);
}
- (void)popoverDidClose:(NSNotification *)notification { [self send:@"rename"]; self.popover = nil; }
- (void)confirm:(id)sender { [self.popover performClose:nil]; }
- (void)location:(id)sender { [self send:@"location"]; [self.popover performClose:nil]; }
- (BOOL)control:(NSControl *)control textView:(NSTextView *)textView doCommandBySelector:(SEL)command {
    if (command == @selector(cancelOperation:)) { self.cancelled = YES; [self.popover performClose:nil]; return YES; }
    if (command == @selector(insertNewline:)) { [self confirm:nil]; return YES; }
    return NO;
}
@end
void size_md_show_title(void *windowPtr, const char *name, const char *path, const char *documentId, double x, double y, double width, double height, TitleCallback callback) {
    if (activeTitle.popover.shown) { [activeTitle.popover performClose:nil]; return; }
    NSWindow *window = (__bridge NSWindow *)windowPtr;
    DocumentPopover *controller = [DocumentPopover new];
    controller.callback = callback;
    controller.documentId = [NSString stringWithUTF8String:documentId];
    controller.originalName = [NSString stringWithUTF8String:name];
    NSView *view = [[NSView alloc] initWithFrame:NSMakeRect(0,0,320,104)];
    controller.view = view;
    NSTextField *label = [NSTextField labelWithString:@"名称："];
    label.frame = NSMakeRect(18,65,44,22);
    label.alignment = NSTextAlignmentRight;
    label.textColor = NSColor.secondaryLabelColor;
    [view addSubview:label];
    NSTextField *field = [[NSTextField alloc] initWithFrame:NSMakeRect(70,64,230,24)];
    field.stringValue = controller.originalName;
    field.bezelStyle = NSTextFieldRoundedBezel;
    field.font = [NSFont systemFontOfSize:13];
    field.delegate = controller;
    field.target = controller;
    field.action = @selector(confirm:);
    controller.nameField = field;
    [view addSubview:field];
    NSTextField *locationLabel = [NSTextField labelWithString:@"位置："];
    locationLabel.frame = NSMakeRect(18,24,44,22);
    locationLabel.alignment = NSTextAlignmentRight;
    locationLabel.textColor = NSColor.secondaryLabelColor;
    [view addSubview:locationLabel];
    NSString *file = [NSString stringWithUTF8String:path];
    NSString *folder = file.length ? file.stringByDeletingLastPathComponent : @"";
    NSPopUpButton *location = [[NSPopUpButton alloc] initWithFrame:NSMakeRect(70,22,230,26) pullsDown:NO];
    [location addItemWithTitle:folder.length ? [NSFileManager.defaultManager displayNameAtPath:folder] : @"尚未保存"];
    if (folder.length) { NSImage *icon = [NSWorkspace.sharedWorkspace iconForFile:folder]; icon.size = NSMakeSize(16,16); location.itemArray[0].image = icon; }
    location.itemArray[0].enabled = NO;
    [location.menu addItem:NSMenuItem.separatorItem];
    [location addItemWithTitle:@"选择位置（另存为）…"];
    location.target = controller;
    location.action = @selector(location:);
    location.toolTip = folder;
    [view addSubview:location];
    NSPopover *popover = [NSPopover new];
    popover.appearance = [NSAppearance appearanceNamed:NSAppearanceNameAqua];
    popover.contentViewController = controller;
    popover.behavior = NSPopoverBehaviorTransient;
    popover.delegate = controller;
    controller.popover = popover;
    activeTitle = controller;
    NSView *content = findEditorView(window.contentView) ?: window.contentView;
    NSRect anchor = NSMakeRect(x, content.isFlipped ? y : content.bounds.size.height - y - height, width, height);
    [popover showRelativeToRect:anchor ofView:content preferredEdge:(content.isFlipped ? NSRectEdgeMaxY : NSRectEdgeMinY)];
    [popover.contentViewController.view.window makeFirstResponder:field];
    [field selectText:nil];
}

#import <WebKit/WebKit.h>
@interface SizeMDPDFJob : NSObject
@property(nonatomic,assign) void (*callback)(bool, void *);
@property(nonatomic,assign) void *context;
@end
static NSMutableSet *pdfJobs;
@implementation SizeMDPDFJob
- (void)finished:(NSPrintOperation *)operation success:(BOOL)success contextInfo:(void *)context {
    self.callback(success,self.context);
    [pdfJobs removeObject:self];
}
@end
void size_md_export_pdf(void *webview, const char *path, double width, double height, double margin, void (*callback)(bool,void *), void *context) {
    @autoreleasepool {
        WKWebView *view = (__bridge WKWebView *)webview;
        NSPrintInfo *info = [[NSPrintInfo sharedPrintInfo] copy];
        info.paperSize = NSMakeSize(width, height);
        info.topMargin = margin; info.bottomMargin = margin;
        info.leftMargin = margin; info.rightMargin = margin;
        info.horizontalPagination = NSFitPagination;
        info.verticalPagination = NSAutoPagination;
        info.horizontallyCentered = NO; info.verticallyCentered = NO;
        info.jobDisposition = NSPrintSaveJob;
        info.dictionary[NSPrintJobSavingURL] = [NSURL fileURLWithPath:[NSString stringWithUTF8String:path]];
        info.dictionary[@"WebKitPrintsBackgrounds"] = @YES;
        NSPrintOperation *operation = [view printOperationWithPrintInfo:info];
        operation.showsPrintPanel = NO;
        operation.showsProgressPanel = YES;
        operation.canSpawnSeparateThread = YES;
        SizeMDPDFJob *job = [SizeMDPDFJob new]; job.callback=callback;job.context=context;
        if(!pdfJobs)pdfJobs=[NSMutableSet new];[pdfJobs addObject:job];
        [operation runOperationModalForWindow:view.window delegate:job didRunSelector:@selector(finished:success:contextInfo:) contextInfo:NULL];
    }
}
