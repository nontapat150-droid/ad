using System.IO;
using System.Security.Cryptography;
using System.Text;
using BoNotesInspector.Core;
using Xunit;
public class DraftTests
{
    [Theory]
    [InlineData("#ปิดงานติดตั้งais","วันที่ติดตั้ง : 18/10/69","install_ais")]
    [InlineData("#ปิดงานติดตั้ง3bb","วันที่ติดตั้ง :18-10-69","install_3bb")]
    [InlineData("#ปิดงานเปลี่ยนอุปกรณ์3bb","วันที่ติดตั้ง :18-10-2569","device_3bb")]
    [InlineData("#งานMA","วันที่แก้ไข :18/10/2026","ma")]
    public void FourJobTypesPreserveThaiDatesAndTextIdentifiers(string tag,string date,string type)
    {
        var p=NoteParser.Parse(tag+"\n"+date+"\nNon : 0088000014\nOrder no : P2610121456759174\nชื่อ-สกุล: ทดสอบ\nSn ONU : : 00O1I\nSn ONU : ABC002\nช่องใหม่ : =2+2");
        Assert.Equal(type,p.Type);Assert.Equal("2026-10-18",p.JobDate);Assert.Equal("0088000014",p.CaseNo);Assert.Equal("P2610121456759174",p.OrderNo);
        Assert.Equal(new[]{"00O1I","ABC002"},p.Sns.Select(s=>s.Value));Assert.Equal(new[]{1,2},p.Fields.Where(f=>f.Label=="Sn ONU").Select(f=>f.Occurrence));Assert.Equal("=2+2",p.Fields.Single(f=>f.Label=="ช่องใหม่").Value);
    }
    [Fact] public void InvalidDateAndMultipleJobsBlockReviewWhileOldMaSnIsRetainedSeparately()
    {
        var p=NoteParser.Parse("#งานMA\nวันที่แก้ไข :31/02/69\nNon : 0001\nSN เก่า : OLD001\nSN ใหม่ : NEW001\n#งานMA\nNon : 0002");
        Assert.NotEmpty(p.Warnings);Assert.Contains(p.Sns,s=>s.Value=="OLD001"&&s.IsOld);Assert.Contains(p.Sns,s=>s.Value=="NEW001"&&!s.IsOld);
    }
    [Fact] public void MissingHumanVerificationAndMissingExportBlockImport()
    {
        var b=ReadyBatch();var i=b.Items[0];i.SnVerified=false;
        Assert.False(ReviewPolicy.CanImport(b,[i.Id],new(ReviewPolicy.Digest(b,[i.Id]),"filehash","a.xlsx",DateTimeOffset.Now)).Allowed);
        i.SnVerified=true;Assert.False(ReviewPolicy.CanImport(b,[i.Id],null).Allowed);
        i.BoundaryVerified=false;Assert.False(ReviewPolicy.CanImport(b,[i.Id],new(ReviewPolicy.Digest(b,[i.Id]),"filehash","a.xlsx",DateTimeOffset.Now)).Allowed);
    }
    [Fact] public void SameCountSelectionAndTextEditsInvalidateExportAndKeepOriginalOcr()
    {
        var b=ReadyBatch();var first=b.Items[0];var other=ReadyBatch().Items[0];other.Text=other.Text.Replace("0001","0002");b.Items.Add(other);
        var receipt=new ExportReceipt(ReviewPolicy.Digest(b,[first.Id]),"filehash","a.xlsx",DateTimeOffset.Now);
        Assert.True(ReviewPolicy.CanImport(b,[first.Id],receipt).Allowed);Assert.False(ReviewPolicy.CanImport(b,[other.Id],receipt).Allowed);
        ReviewPolicy.ApplyReview(first,first.Text.Replace("ABC001","ABC002"),1,"ช่าง",false,false,false,false);
        Assert.False(ReviewPolicy.CanImport(b,[first.Id],receipt).Allowed);Assert.Equal(2,first.Revision);Assert.Contains("ABC001",first.OriginalOcr);Assert.Single(first.Edits);
    }
    [Fact] public async Task AtomicStoreSurvivesIncompleteTemporaryWriteAndRejectsMissingEvidence()
    {
        var dir=Path.Combine(Path.GetTempPath(),"bo-notes-"+Guid.NewGuid());Directory.CreateDirectory(Path.Combine(dir,"images"));
        try{var b=ReadyBatch();var bytes=Encoding.UTF8.GetBytes("test image evidence");File.WriteAllBytes(Path.Combine(dir,"images","one.png"),bytes);b.Evidence[0].Sha256=Convert.ToHexString(SHA256.HashData(bytes));
            var s=new DraftStore(dir);await s.SaveAsync(b);File.WriteAllText(Path.Combine(dir,"draft.json.tmp"),"{ incomplete");var restored=await s.LoadAsync();Assert.Equal(b.Id,restored.Id);Assert.Single(restored.Items);Assert.Equal("0001",NoteParser.Parse(restored.Items[0].Text).CaseNo);
            b.Items[0].EvidenceIds.Add("missing");await Assert.ThrowsAsync<InvalidDataException>(()=>s.SaveAsync(b));
        }finally{Directory.Delete(dir,true);}
    }
    internal static DraftBatch ReadyBatch()
    {
        const string raw="#งานMA\nวันที่แก้ไข :19/10/69\nNon : 0001\nSN ใหม่ : ABC001\nหมายเหตุ :";
        return new(){Group="กลุ่มทดสอบ",Evidence=[new(){Id="one",FileName="one.png",Sha256=new string('A',64)}],Items=[new(){Text=raw,OriginalOcr=raw,TechnicianId=1,TechnicianName="ช่างทดสอบ",TextVerified=true,DateVerified=true,SnVerified=true,BoundaryVerified=true,EvidenceIds=["one"]}]};
    }
    [Fact] public async Task UnsupportedDraftSchemaCannotSneakThroughFailedBackupRead()
    {
        var dir=Path.Combine(Path.GetTempPath(),"bo-notes-schema-"+Guid.NewGuid());Directory.CreateDirectory(dir);
        try{await File.WriteAllTextAsync(Path.Combine(dir,"draft.json"),"{\"SchemaVersion\": 9, \"Items\": [], \"Evidence\": []}");await Assert.ThrowsAsync<InvalidDataException>(()=>new DraftStore(dir).LoadAsync());}
        finally{Directory.Delete(dir,true);}
    }
}
