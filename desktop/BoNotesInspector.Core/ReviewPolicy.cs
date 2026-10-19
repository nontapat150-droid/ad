using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
namespace BoNotesInspector.Core;
public static class ReviewPolicy
{
    public static string Digest(DraftBatch batch,IEnumerable<Guid> selected)
    {
        var ids=selected.ToHashSet();var payload=new{batchId=batch.Id,group=batch.Group,items=batch.Items.Where(i=>ids.Contains(i.Id)).OrderBy(i=>i.Id).Select(i=>new{i.Id,i.Revision,i.Text,i.OriginalOcr,i.TechnicianId,i.Author,i.PostedText,i.CapturedAt,i.TextVerified,i.DateVerified,i.SnVerified,i.BoundaryVerified,i.Excluded,evidence=i.EvidenceIds.OrderBy(s=>s).Select(id=>new{id,hash=batch.Evidence.FirstOrDefault(e=>e.Id==id)?.Sha256})}),selectedIds=ids.OrderBy(i=>i)};
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload))));
    }
    public static ValidationResult CanImport(DraftBatch batch,IEnumerable<Guid> selected,ExportReceipt? receipt)
    {
        var ids=selected.ToHashSet();var errors=new List<string>();if(ids.Count==0)errors.Add("ยังไม่ได้เลือกรายการ");if(string.IsNullOrWhiteSpace(batch.Group))errors.Add("ยังไม่ได้ยืนยันชื่อกลุ่ม");
        if(receipt==null||receipt.Digest!=Digest(batch,ids))errors.Add("ต้องส่งออก Excel ของชุดและรุ่นข้อมูลปัจจุบันก่อนนำเข้า");
        var business=new HashSet<string>();
        foreach(var id in ids)
        {
            var i=batch.Items.SingleOrDefault(i=>i.Id==id);if(i==null){errors.Add("รายการที่เลือกไม่อยู่ในชุดนี้");continue;}
            var p=NoteParser.Parse(i.Text);var prefix=$"รายการ {batch.Items.IndexOf(i)+1}: ";
            if(i.Excluded)errors.Add(prefix+"ถูกตัดออกจากชุด");
            if(!i.TextVerified||!i.DateVerified||!i.SnVerified||!i.BoundaryVerified)errors.Add(prefix+"ต้องตรวจข้อความ วันที่ SN และขอบเขตโพสต์กับภาพก่อน");
            if(i.TechnicianId<=0)errors.Add(prefix+"ยังไม่ได้เลือกช่างเจ้าของงาน");
            if(i.EvidenceIds.Count==0||i.EvidenceIds.Any(id=>!batch.Evidence.Any(e=>e.Id==id&&e.Sha256.Length==64)))errors.Add(prefix+"หลักฐานภาพไม่ครบ");
            errors.AddRange(p.Warnings.Select(w=>prefix+w));
            var key=string.Join("|",p.Type,p.JobDate,p.CaseNo,p.OrderNo,p.Srt);if(!business.Add(key))errors.Add(prefix+"มีเลขงานและวันที่ซ้ำในชุดที่เลือก กรุณาเลือกเพียงรุ่นที่จะนำเข้า");
        }
        return new(errors.Count==0,errors.Distinct().ToArray());
    }
    public static void ApplyReview(DraftItem item,string text,int technicianId,string technicianName,bool textVerified,bool dateVerified,bool snVerified,bool boundaryVerified)
    {
        if(text!=item.Text||technicianId!=item.TechnicianId){item.Edits.Add(new(DateTimeOffset.Now,item.Revision,item.Text,text,item.TechnicianId,technicianId));item.Revision++;item.Text=text;item.TechnicianId=technicianId;item.TechnicianName=technicianName;item.ImportStatus="ยังไม่นำเข้า";item.ServerRecordIds=[];}
        item.TextVerified=textVerified;item.DateVerified=dateVerified;item.SnVerified=snVerified;item.BoundaryVerified=boundaryVerified;
    }
}
