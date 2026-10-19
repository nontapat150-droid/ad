using System.IO;
using System.IO.Compression;
using System.Xml.Linq;
using BoNotesInspector.Core;
using Xunit;
public class WorkbookTests
{
    private static readonly XNamespace Ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    [Fact] public void ExportReadbackPreservesRepeatedColumnsStringIdsDatesAndFormulaLikeText()
    {
        var b=DraftTests.ReadyBatch();b.Items[0].Text="#ปิดงานติดตั้ง3bb\nวันที่ติดตั้ง :19-10-69\nปิดเคสงาน :00884200652\norder no :P2610131241324277\nSn ONU : : 00O1I\nSn ONU : ABC002\nหมายเหตุ : =HYPERLINK(\"example\")";
        var dir=Path.Combine(Path.GetTempPath(),"bo-notes-book-"+Guid.NewGuid());Directory.CreateDirectory(dir);var path=Path.Combine(dir,"report.xlsx");
        try{var receipt=WorkbookWriter.Export(b,[b.Items[0].Id],path);Assert.True(File.Exists(path));Assert.Equal(64,receipt.FileHash.Length);Assert.Equal(ReviewPolicy.Digest(b,[b.Items[0].Id]),receipt.Digest);
            using var zip=ZipFile.OpenRead(path);var book=Read(zip,"xl/workbook.xml");Assert.Equal(new[]{"สรุป","ติดตั้ง AIS","ติดตั้ง 3BB","เปลี่ยนอุปกรณ์ 3BB","งาน MA","ไม่รู้ประเภท","ตรวจ SN","ต้นฉบับและแหล่งที่มา","ผลนำเข้า"},book.Descendants(Ns+"sheet").Select(s=>(string?)s.Attribute("name")));
            var source=Read(zip,"xl/worksheets/sheet3.xml");var rows=source.Descendants(Ns+"row").ToList();var headers=Cells(rows[0]);Assert.Equal(new[]{"วันที่ติดตั้ง","ปิดเคสงาน","order no","Sn ONU","Sn ONU","หมายเหตุ"},headers);
            Assert.Equal(new[]{"19-10-69","00884200652","P2610131241324277","00O1I","ABC002","=HYPERLINK(\"example\")"},Cells(rows[1]));
            Assert.Empty(source.Descendants(Ns+"f"));Assert.All(rows[1].Elements(Ns+"c"),cell=>Assert.Equal("inlineStr",(string?)cell.Attribute("t")));
            Assert.Contains("ยังไม่นำเข้า",Read(zip,"xl/worksheets/sheet9.xml").Root!.Value);
        }finally{Directory.Delete(dir,true);}
    }
    [Fact] public void LongOriginalTextAndUnknownTypeRemainLosslessInChunkedSourceRows()
    {
        var b=DraftTests.ReadyBatch();b.Items[0].Text="หัวข้อที่ไม่รู้จัก\n"+new string('ก',70000);b.Items[0].OriginalOcr=b.Items[0].Text;var dir=Path.Combine(Path.GetTempPath(),"bo-notes-long-"+Guid.NewGuid());Directory.CreateDirectory(dir);
        try{var path=Path.Combine(dir,"report.xlsx");WorkbookWriter.Export(b,[b.Items[0].Id],path);using var zip=ZipFile.OpenRead(path);var raw=Read(zip,"xl/worksheets/sheet8.xml");var rows=raw.Descendants(Ns+"row").Skip(1).Select(Cells).Where(r=>r[2]=="ข้อความรับรอง").ToList();Assert.Equal(b.Items[0].Text,string.Concat(rows.Select(r=>r[5])));Assert.All(raw.Descendants(Ns+"t"),t=>Assert.True(t.Value.Length<=32767));Assert.NotEmpty(Read(zip,"xl/worksheets/sheet6.xml").Descendants(Ns+"row").Skip(1));}
        finally{Directory.Delete(dir,true);}
    }
    [Fact] public void EvidenceZipContainsOnlyChosenImagesAndRelativeManifestPaths()
    {
        var b=DraftTests.ReadyBatch();var dir=Path.Combine(Path.GetTempPath(),"bo-notes-evidence-"+Guid.NewGuid());Directory.CreateDirectory(Path.Combine(dir,"images"));
        try{var bytes=new byte[]{1,2,3};File.WriteAllBytes(Path.Combine(dir,"images","one.png"),bytes);b.Evidence[0].Sha256=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes));File.WriteAllText(Path.Combine(dir,"images","unrelated.png"),"private unrelated");var path=Path.Combine(dir,"evidence.zip");var receipt=WorkbookWriter.ExportEvidenceZip(b,[b.Items[0].Id],dir,path);Assert.True(File.Exists(path));using var zip=ZipFile.OpenRead(path);Assert.Equal(new[]{"report.xlsx","manifest.json","images/one.png"}.Order(),zip.Entries.Select(e=>e.FullName).Order());using var r=new StreamReader(zip.GetEntry("manifest.json")!.Open());var manifest=r.ReadToEnd();Assert.DoesNotContain(dir,manifest);Assert.Equal(ReviewPolicy.Digest(b,[b.Items[0].Id]),receipt.Digest);}
        finally{Directory.Delete(dir,true);}
    }
    private static XDocument Read(ZipArchive zip,string name){using var stream=zip.GetEntry(name)!.Open();return XDocument.Load(stream);}
    private static string[] Cells(XElement row)=>row.Elements(Ns+"c").Select(c=>string.Concat(c.Descendants(Ns+"t").Select(t=>t.Value))).ToArray();
}
