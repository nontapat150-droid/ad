using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml;
namespace BoNotesInspector.Core;
public static class WorkbookWriter
{
    private const string Ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private const string RelNs="http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private record Table(string Name,List<object?[]> Rows);
    public static ExportReceipt Export(DraftBatch batch,IEnumerable<Guid> selected,string path)
    {
        var ids=selected.ToHashSet();var bytes=BuildWorkbook(batch,ids);AtomicWrite(path,bytes);
        return new(ReviewPolicy.Digest(batch,ids),Convert.ToHexString(SHA256.HashData(bytes)),path,DateTimeOffset.Now);
    }
    public static ExportReceipt ExportEvidenceZip(DraftBatch batch,IEnumerable<Guid> selected,string directory,string path)
    {
        var ids=selected.ToHashSet();var items=batch.Items.Where(i=>ids.Contains(i.Id)).ToList();var evidenceIds=items.SelectMany(i=>i.EvidenceIds).ToHashSet();var evidence=batch.Evidence.Where(e=>evidenceIds.Contains(e.Id)).ToList();
        var subset=new DraftBatch{Id=batch.Id,Group=batch.Group,Items=items,Evidence=evidence};new DraftStore(directory).ValidateEvidence(subset);
        var workbook=BuildWorkbook(batch,ids);using var memory=new MemoryStream();
        using(var zip=new ZipArchive(memory,ZipArchiveMode.Create,true))
        {
            using(var entry=zip.CreateEntry("report.xlsx").Open())entry.Write(workbook);
            var manifest=new{schemaVersion=1,batchId=batch.Id,group=batch.Group,exportedAt=DateTimeOffset.Now,digest=ReviewPolicy.Digest(batch,ids),workbookHash=Convert.ToHexString(SHA256.HashData(workbook)),items,evidence=evidence.Select(e=>new{e.Id,path="images/"+e.FileName,e.Sha256})};
            using(var entry=zip.CreateEntry("manifest.json").Open())JsonSerializer.Serialize(entry,manifest,new JsonSerializerOptions{WriteIndented=true});
            foreach(var asset in evidence)zip.CreateEntryFromFile(Path.Combine(directory,"images",asset.FileName),"images/"+asset.FileName,CompressionLevel.Optimal);
        }
        var bytes=memory.ToArray();AtomicWrite(path,bytes);return new(ReviewPolicy.Digest(batch,ids),Convert.ToHexString(SHA256.HashData(bytes)),path,DateTimeOffset.Now);
    }
    private static void AtomicWrite(string path,byte[] bytes)
    {
        var full=Path.GetFullPath(path);Directory.CreateDirectory(Path.GetDirectoryName(full)!);var temp=full+"."+Guid.NewGuid().ToString("N")+".tmp";
        try{using(var f=new FileStream(temp,FileMode.CreateNew,FileAccess.Write,FileShare.None)){f.Write(bytes);f.Flush(true);}File.Move(temp,full,true);}finally{if(File.Exists(temp))File.Delete(temp);}
    }
    private static byte[] BuildWorkbook(DraftBatch batch,HashSet<Guid> ids)
    {
        if(ids.Count==0||ids.Any(id=>!batch.Items.Any(i=>i.Id==id)))throw new InvalidDataException("เลือกรายการที่จะส่งออกก่อน");
        var items=batch.Items.Where(i=>ids.Contains(i.Id)).ToList();var parsed=items.ToDictionary(i=>i.Id,i=>NoteParser.Parse(i.Text));
        var summary=new Table("สรุป",[R("รายการ","รหัสรายการ","รุ่น","ประเภท","วันที่งานมาตรฐาน","กลุ่ม","ผู้โพสต์","เวลาโพสต์ที่เห็น","เวลาอ่าน (ไทย)","รหัสช่าง","ช่าง","เลขเคส","Order no","SRT","ตรวจข้อความ","ตรวจวันที่","ตรวจ SN","ตรวจขอบเขต","สถานะนำเข้า","รหัสชุด","หลักฐานภาพ")]);
        var tables=new List<Table>{summary};
        foreach(var type in NoteParser.TypeNames)
        {
            var selected=items.Where(i=>parsed[i.Id].Type==type.Key).ToList();var schema=new List<(string Label,int Occurrence)>();
            foreach(var i in selected)foreach(var f in parsed[i.Id].Fields)if(!schema.Contains((f.Label,f.Occurrence)))schema.Add((f.Label,f.Occurrence));
            var table=new Table(type.Value,[]);if(schema.Count==0)table.Rows.Add(R("ข้อความต้นฉบับ"));else table.Rows.Add(schema.Select(c=>(object?)c.Label).ToArray());
            foreach(var i in selected)table.Rows.Add(schema.Count==0?R(i.Text):schema.Select(c=>(object?)(parsed[i.Id].Fields.FirstOrDefault(f=>f.Label==c.Label&&f.Occurrence==c.Occurrence)?.Value??"")).ToArray());
            tables.Add(table);
        }
        var sns=new Table("ตรวจ SN",[R("รหัสรายการ","วันที่งาน","ประเภท","ช่าง","บทบาท","SN ต้นฉบับ","SN เก่า","ผู้ตรวจยืนยันแล้ว","สถานะนำเข้า")]);
        var raw=new Table("ต้นฉบับและแหล่งที่มา",[R("รหัสรายการ","รุ่น","ประเภทข้อความ","ส่วน","จำนวนส่วน","ข้อความ","กลุ่ม","ผู้โพสต์","เวลาโพสต์ที่เห็น","เวลาอ่าน (ไทย)","ภาพอ้างอิง")]);
        var results=new Table("ผลนำเข้า",[R("รหัสรายการ","รุ่น","วันที่งาน","เลขเคส","Order no","ช่าง","สถานะ","รหัสรายการใน BO ad","ข้อสังเกต")]);
        for(int n=0;n<items.Count;n++)
        {
            var i=items[n];var p=parsed[i.Id];var time=i.CapturedAt.ToOffset(TimeSpan.FromHours(7)).ToString("yyyy-MM-dd HH:mm:ss zzz",CultureInfo.InvariantCulture);string Check(bool yes)=>yes?"ยืนยันแล้ว":"ยังไม่ยืนยัน";
            summary.Rows.Add(R(n+1,i.Id.ToString(),i.Revision,NoteParser.TypeNames[p.Type],p.JobDate,batch.Group,i.Author,i.PostedText,time,i.TechnicianId>0?i.TechnicianId.ToString(CultureInfo.InvariantCulture):"",i.TechnicianName,p.CaseNo,p.OrderNo,p.Srt,Check(i.TextVerified),Check(i.DateVerified),Check(i.SnVerified),Check(i.BoundaryVerified),i.ImportStatus,batch.Id.ToString(),string.Join("\n",i.EvidenceIds.Select(id=>"images/"+(batch.Evidence.FirstOrDefault(a=>a.Id==id)?.FileName??id+".png")))));
            foreach(var sn in p.Sns)sns.Rows.Add(R(i.Id.ToString(),p.JobDate,NoteParser.TypeNames[p.Type],i.TechnicianName,sn.Role,sn.Value,sn.IsOld?"ใช่ — ไม่เสนอหัก":"ไม่ใช่",Check(i.SnVerified),i.ImportStatus));
            foreach(var variant in new[]{("OCR เดิม",i.OriginalOcr),("ข้อความรับรอง",i.Text)}){var parts=RawChunks(variant.Item2);for(int part=0;part<parts.Count;part++)raw.Rows.Add(R(i.Id.ToString(),i.Revision,variant.Item1,part+1,parts.Count,parts[part],batch.Group,i.Author,i.PostedText,time,string.Join("\n",i.EvidenceIds)));}
            results.Rows.Add(R(i.Id.ToString(),i.Revision,p.JobDate,p.CaseNo,p.OrderNo,i.TechnicianName,i.ImportStatus,string.Join(",",i.ServerRecordIds),string.Join("\n",p.Warnings)));
        }
        tables.AddRange([sns,raw,results]);
        using var memory=new MemoryStream();using(var zip=new ZipArchive(memory,ZipArchiveMode.Create,true))
        {
            Xml(zip,"[Content_Types].xml",x=>{x.WriteStartElement("Types","http://schemas.openxmlformats.org/package/2006/content-types");void Def(string ext,string type){x.WriteStartElement("Default");x.WriteAttributeString("Extension",ext);x.WriteAttributeString("ContentType",type);x.WriteEndElement();}void Over(string part,string type){x.WriteStartElement("Override");x.WriteAttributeString("PartName",part);x.WriteAttributeString("ContentType",type);x.WriteEndElement();}Def("rels","application/vnd.openxmlformats-package.relationships+xml");Def("xml","application/xml");Over("/xl/workbook.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml");Over("/xl/styles.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml");for(int j=1;j<=tables.Count;j++)Over($"/xl/worksheets/sheet{j}.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml");x.WriteEndElement();});
            Xml(zip,"_rels/.rels",x=>{x.WriteStartElement("Relationships","http://schemas.openxmlformats.org/package/2006/relationships");Relationship(x,"rId1",RelNs+"/officeDocument","xl/workbook.xml");x.WriteEndElement();});
            Xml(zip,"xl/workbook.xml",x=>{x.WriteStartElement("workbook",Ns);x.WriteAttributeString("xmlns","r",null,RelNs);x.WriteStartElement("sheets");for(int j=0;j<tables.Count;j++){x.WriteStartElement("sheet");x.WriteAttributeString("name",tables[j].Name);x.WriteAttributeString("sheetId",(j+1).ToString());x.WriteAttributeString("r","id",RelNs,"rId"+(j+1));x.WriteEndElement();}x.WriteEndElement();x.WriteEndElement();});
            Xml(zip,"xl/_rels/workbook.xml.rels",x=>{x.WriteStartElement("Relationships","http://schemas.openxmlformats.org/package/2006/relationships");for(int j=1;j<=tables.Count;j++)Relationship(x,"rId"+j,RelNs+"/worksheet",$"worksheets/sheet{j}.xml");Relationship(x,"rId"+(tables.Count+1),RelNs+"/styles","styles.xml");x.WriteEndElement();});
            Xml(zip,"xl/styles.xml",Styles);for(int j=0;j<tables.Count;j++){var table=tables[j];Xml(zip,$"xl/worksheets/sheet{j+1}.xml",x=>WriteSheet(x,table));}
        }
        return memory.ToArray();
    }
    private static object?[] R(params object?[] values)=>values;
    private static List<string> Chunks(string text)
    {
        var result=new List<string>();for(int start=0;start<text.Length;){int length=Math.Min(30000,text.Length-start);if(start+length<text.Length&&char.IsHighSurrogate(text[start+length-1]))length--;result.Add(text.Substring(start,length));start+=length;}if(result.Count==0)result.Add("");return result;
    }
    private static List<string> RawChunks(string text)
    {
        var parts=new List<string>();for(int start=0;start<text.Length;){int end=Math.Min(start+1000,text.Length),lines=0;for(int i=start;i<end;i++)if(text[i]=='\n'&&++lines==10){end=i+1;break;}if(end<text.Length&&char.IsHighSurrogate(text[end-1]))end--;parts.Add(text[start..end]);start=end;}if(parts.Count==0)parts.Add("");return parts;
    }
    private static void Xml(ZipArchive zip,string name,Action<XmlWriter> action){using var stream=zip.CreateEntry(name,CompressionLevel.Optimal).Open();using var writer=XmlWriter.Create(stream,new(){Encoding=new UTF8Encoding(false),CloseOutput=false});action(writer);}
    private static void Relationship(XmlWriter x,string id,string type,string target){x.WriteStartElement("Relationship");x.WriteAttributeString("Id",id);x.WriteAttributeString("Type",type);x.WriteAttributeString("Target",target);x.WriteEndElement();}
    private static void Styles(XmlWriter x)
    {
        x.WriteStartElement("styleSheet",Ns);x.WriteStartElement("numFmts");x.WriteAttributeString("count","1");x.WriteStartElement("numFmt");x.WriteAttributeString("numFmtId","164");x.WriteAttributeString("formatCode","@");x.WriteEndElement();x.WriteEndElement();x.WriteStartElement("fonts");x.WriteAttributeString("count","2");for(int i=0;i<2;i++){x.WriteStartElement("font");x.WriteStartElement("sz");x.WriteAttributeString("val","11");x.WriteEndElement();x.WriteStartElement("name");x.WriteAttributeString("val","Leelawadee UI");x.WriteEndElement();if(i==1){x.WriteElementString("b","");x.WriteStartElement("color");x.WriteAttributeString("rgb","FFFFFFFF");x.WriteEndElement();}x.WriteEndElement();}x.WriteEndElement();
        x.WriteStartElement("fills");x.WriteAttributeString("count","3");foreach(var type in new[]{"none","gray125","solid"}){x.WriteStartElement("fill");x.WriteStartElement("patternFill");x.WriteAttributeString("patternType",type);if(type=="solid"){x.WriteStartElement("fgColor");x.WriteAttributeString("rgb","FF1D684A");x.WriteEndElement();x.WriteStartElement("bgColor");x.WriteAttributeString("indexed","64");x.WriteEndElement();}x.WriteEndElement();x.WriteEndElement();}x.WriteEndElement();
        x.WriteStartElement("borders");x.WriteAttributeString("count","1");x.WriteStartElement("border");foreach(var edge in new[]{"left","right","top","bottom","diagonal"})x.WriteElementString(edge,"");x.WriteEndElement();x.WriteEndElement();
        x.WriteStartElement("cellStyleXfs");x.WriteAttributeString("count","1");x.WriteStartElement("xf");x.WriteAttributeString("numFmtId","0");x.WriteAttributeString("fontId","0");x.WriteAttributeString("fillId","0");x.WriteAttributeString("borderId","0");x.WriteEndElement();x.WriteEndElement();
        x.WriteStartElement("cellXfs");x.WriteAttributeString("count","3");for(int i=0;i<3;i++){x.WriteStartElement("xf");x.WriteAttributeString("numFmtId",i==2?"164":"0");x.WriteAttributeString("applyNumberFormat","1");x.WriteAttributeString("fontId",i==1?"1":"0");x.WriteAttributeString("fillId",i==1?"2":"0");x.WriteAttributeString("borderId","0");x.WriteAttributeString("xfId","0");x.WriteAttributeString("applyAlignment","1");x.WriteStartElement("alignment");x.WriteAttributeString("vertical","top");x.WriteAttributeString("wrapText","1");x.WriteEndElement();x.WriteEndElement();}x.WriteEndElement();x.WriteStartElement("cellStyles");x.WriteAttributeString("count","1");x.WriteStartElement("cellStyle");x.WriteAttributeString("name","Normal");x.WriteAttributeString("xfId","0");x.WriteAttributeString("builtinId","0");x.WriteEndElement();x.WriteEndElement();x.WriteEndElement();
    }
    private static void WriteSheet(XmlWriter x,Table table)
    {
        var rows=table.Rows;int columns=rows.Max(r=>r.Length);var parts=Enumerable.Range(0,columns).Select(c=>rows.Skip(1).Select(r=>c<r.Length&&r[c] is string s?Chunks(s).Count:1).DefaultIfEmpty(1).Max()).ToArray();
        if(parts.Sum()>16384||rows.Count>1048576)throw new InvalidDataException("ข้อมูลเกินขนาดแผ่นงาน Excel กรุณาแบ่งชุด");
        var expanded=rows.Select((r,n)=>Enumerable.Range(0,columns).SelectMany(c=>Enumerable.Range(0,parts[c]).Select(part=>n==0?(c<r.Length?r[c]:""):c>=r.Length?"":r[c] is string s?(object?)(Chunks(s).ElementAtOrDefault(part)??""):part==0?r[c]:"")).ToArray()).ToList();columns=expanded[0].Length;
        x.WriteStartElement("worksheet",Ns);x.WriteStartElement("sheetViews");x.WriteStartElement("sheetView");x.WriteAttributeString("workbookViewId","0");x.WriteAttributeString("showGridLines","0");x.WriteStartElement("pane");x.WriteAttributeString("ySplit","1");x.WriteAttributeString("topLeftCell","A2");x.WriteAttributeString("activePane","bottomLeft");x.WriteAttributeString("state","frozen");x.WriteEndElement();x.WriteEndElement();x.WriteEndElement();
        var widths=Enumerable.Range(0,columns).Select(c=>Math.Clamp(expanded.Take(100).Select(r=>r[c]?.ToString()?.Split('\n').Max(v=>v.Length)??0).Max()+3,14,48)).ToArray();
        x.WriteStartElement("cols");for(int c=0;c<columns;c++){x.WriteStartElement("col");x.WriteAttributeString("min",(c+1).ToString());x.WriteAttributeString("max",(c+1).ToString());x.WriteAttributeString("width",widths[c].ToString(CultureInfo.InvariantCulture));x.WriteAttributeString("customWidth","1");x.WriteEndElement();}x.WriteEndElement();
        x.WriteStartElement("sheetData");for(int r=0;r<expanded.Count;r++)
        {
            x.WriteStartElement("row");x.WriteAttributeString("r",(r+1).ToString());x.WriteAttributeString("ht",r==0?"34":Math.Clamp(Enumerable.Range(0,columns).Max(c=>(expanded[r][c]?.ToString()??"").Split('\n').Sum(line=>Math.Max(1,(int)Math.Ceiling((double)line.Length/Math.Max(8,widths[c]-3)))))*16+6,30,409).ToString());x.WriteAttributeString("customHeight","1");
            for(int c=0;c<columns;c++){var value=expanded[r][c];x.WriteStartElement("c");x.WriteAttributeString("r",Column(c+1)+(r+1));x.WriteAttributeString("s",r==0?"1":value is int or long?"0":"2");if(value is int or long){x.WriteElementString("v",Convert.ToString(value,CultureInfo.InvariantCulture));}else{x.WriteAttributeString("t","inlineStr");x.WriteStartElement("is");x.WriteStartElement("t");x.WriteAttributeString("xml","space","http://www.w3.org/XML/1998/namespace","preserve");x.WriteString(Escape(value?.ToString()??""));x.WriteEndElement();x.WriteEndElement();}x.WriteEndElement();}x.WriteEndElement();
        }
        x.WriteEndElement();if(expanded.Count>1){x.WriteStartElement("autoFilter");x.WriteAttributeString("ref","A1:"+Column(columns)+expanded.Count);x.WriteEndElement();}x.WriteEndElement();
    }
    private static string Column(int number){string value="";while(number>0){number--;value=(char)('A'+number%26)+value;number/=26;}return value;}
    private static string Escape(string text)
    {
        text=Regex.Replace(text,@"_x[0-9A-Fa-f]{4}_",m=>"_x005F_"+m.Value[1..]);var b=new StringBuilder();for(int i=0;i<text.Length;i++){char c=text[i];if(char.IsHighSurrogate(c)&&i+1<text.Length&&char.IsLowSurrogate(text[i+1])){b.Append(c).Append(text[++i]);}else if(XmlConvert.IsXmlChar(c))b.Append(c);else b.Append("_x"+((int)c).ToString("X4")+"_");}return b.ToString();
    }
}
