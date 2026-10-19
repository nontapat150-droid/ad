namespace BoNotesInspector.Core;
public record NoteField(string Key,string Label,string Value,int Occurrence);
public record NoteSn(string Role,string Value,bool IsOld=false);
public sealed class ParsedNote
{
    public string Type {get;set;}="unknown";
    public string JobDate {get;set;}="";
    public string CaseNo {get;set;}="";
    public string OrderNo {get;set;}="";
    public string Srt {get;set;}="";
    public string Customer {get;set;}="";
    public List<NoteField> Fields {get;set;}=[];
    public List<NoteSn> Sns {get;set;}=[];
    public List<string> Warnings {get;set;}=[];
}
public sealed class EvidenceAsset
{
    public string Id {get;set;}="";
    public string FileName {get;set;}="";
    public string Sha256 {get;set;}="";
}
public sealed class DraftItem
{
    public Guid Id {get;set;}=Guid.NewGuid();
    public int Revision {get;set;}=1;
    public string OriginalOcr {get;set;}="";
    public string Text {get;set;}="";
    public string Author {get;set;}="";
    public string PostedText {get;set;}="";
    public DateTimeOffset CapturedAt {get;set;}=DateTimeOffset.Now;
    public List<string> EvidenceIds {get;set;}=[];
    public int TechnicianId {get;set;}
    public string TechnicianName {get;set;}="";
    public bool TextVerified {get;set;}
    public bool DateVerified {get;set;}
    public bool SnVerified {get;set;}
    public bool BoundaryVerified {get;set;}
    public bool SourceComplete {get;set;}
    public bool Selected {get;set;}=true;
    public bool Excluded {get;set;}
    public string ImportStatus {get;set;}="ยังไม่นำเข้า";
    public List<long> ServerRecordIds {get;set;}=[];
    public List<EditEntry> Edits {get;set;}=[];
}
public record EditEntry(DateTimeOffset At,int Revision,string Before,string After,int TechnicianBefore,int TechnicianAfter);
public record ExportReceipt(string Digest,string FileHash,string FileName,DateTimeOffset ExportedAt);
public sealed class DraftBatch
{
    public int SchemaVersion {get;set;}=1;
    public Guid Id {get;set;}=Guid.NewGuid();
    public string Group {get;set;}="";
    public DateTimeOffset CreatedAt {get;set;}=DateTimeOffset.Now;
    public DateTimeOffset UpdatedAt {get;set;}=DateTimeOffset.Now;
    public int FrameCount {get;set;}
    public string CaptureReason {get;set;}="ยังไม่เริ่มอ่าน";
    public List<DraftItem> Items {get;set;}=[];
    public List<EvidenceAsset> Evidence {get;set;}=[];
    public ExportReceipt? Export {get;set;}
}
public record ValidationResult(bool Allowed,IReadOnlyList<string> Errors);
public record Technician(int Id,string FullName);
