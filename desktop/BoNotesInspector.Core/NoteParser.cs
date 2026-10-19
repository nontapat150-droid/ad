using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
namespace BoNotesInspector.Core;
public static class NoteParser
{
    public static readonly IReadOnlyDictionary<string,string> TypeNames=new Dictionary<string,string>{{"install_ais","ติดตั้ง AIS"},{"install_3bb","ติดตั้ง 3BB"},{"device_3bb","เปลี่ยนอุปกรณ์ 3BB"},{"ma","งาน MA"},{"unknown","ไม่รู้ประเภท"}};
    public static readonly IReadOnlyDictionary<string,string> TypeTags=new Dictionary<string,string>{{"install_ais","#ปิดงานติดตั้งais"},{"install_3bb","#ปิดงานติดตั้ง3bb"},{"device_3bb","#ปิดงานเปลี่ยนอุปกรณ์3bb"},{"ma","#งานMA"}};
    private static readonly (string Key,Regex Pattern)[] Definitions=new (string,string)[]{
      ("date",@"วันที่ติดตั้ง|วันที่แก้ไข"),("caseNo",@"ปิดเคสงาน|non"),("orderNo",@"order\s*no"),("orderType",@"order\s*type"),("srt",@"srt"),("customer",@"ชื่อ\s*[-–]\s*สกุล|ชื่อสกุล|ชื่อลูกค้า"),
      ("package",@"แพ[็กค]*เกจ(?:หลัก)?"),("soa",@"(?:อุปกรณ[์ร]*\s*)?ปิด\s*soa"),("network",@"โครงข่าย"),("splitter",@"splitter|spt"),("port",@"ใช้\s*port"),("l3",@"ใช้\s*#?l3(?:\s*\(ชื่อ\))?"),
      ("maCable",@"ระยะสายที่ใช้ในงาน\s*MA(?:\s*New/MA\s*Splice)?"),("cableMeters",@"ระยะสายจริง"),("ref3bb",@"ref\s*id\s*3bb"),("sc",@"ตัวต่อ\s*sc(?:สีฟ้า)?"),("fee",@"ค่าแรกเข้า"),("notes",@"หมายเหตุ"),
      ("cause",@"สาเหตุ"),("solution",@"วิธีแก้ไข"),("usedEquipment",@"อุปกรณ์ที่ใช้"),("oldSn",@"sn\s*เก่า"),("newSn",@"sn\s*ใหม่"),("sn:Mesh",@"sn\s*mesh\s*เช่า"),("sn:Cam",@"sn\s*ip\s*camera"),("sn:PB",@"sn\s*playbox"),("sn:ONU",@"sn\s*onu"),("sn:Mesh",@"sn\s*mesh"),("sn:SIM",@"sn\s*sim")
    }.Select(d=>(d.Item1,new Regex("^("+d.Item2+")(?=\\s|[:：]|$)\\s*[:：]*\\s*(.*)$",RegexOptions.IgnoreCase))).ToArray();
    public static ParsedNote Parse(string text)
    {
        var result=new ParsedNote();if(Encoding.UTF8.GetByteCount(text)>200000){result.Warnings.Add("ข้อความเกิน 200 KB");return result;}
        var lines=text.Replace("\r\n","\n").Replace('\r','\n').Trim().Split('\n');
        var tag=lines.FirstOrDefault()?.Trim()??"";
        result.Type=TypeTags.FirstOrDefault(p=>string.Equals(p.Value,tag,StringComparison.OrdinalIgnoreCase)).Key??"unknown";
        if(result.Type=="unknown")result.Warnings.Add("กรุณายืนยันและแก้แท็กประเภทงานให้ถูกต้อง");
        if(lines.Count(l=>TypeTags.Values.Any(t=>l.Trim().Equals(t,StringComparison.OrdinalIgnoreCase)))>1)result.Warnings.Add("มีหลายงานในรายการเดียว กรุณาแยกรายการก่อน");
        var count=new Dictionary<string,int>(StringComparer.Ordinal);var semantic=new Dictionary<string,string>();
        foreach(var raw in lines.Skip(1))
        {
            var line=raw.Trim();if(line.Length==0)continue;if(TypeTags.Values.Any(t=>t.Equals(line,StringComparison.OrdinalIgnoreCase)))break;NoteField? field=null;
            foreach(var (key,pattern) in Definitions){var m=pattern.Match(line);if(m.Success){field=new(key,m.Groups[1].Value.Trim(),m.Groups[2].Value.TrimStart(':','：',' ').Trim(),0);break;}}
            if(field==null){var m=Regex.Match(line,@"^([^:：]{1,100})[:：]+\s*(.*)$");if(m.Success)field=new("",m.Groups[1].Value.Trim(),m.Groups[2].Value.Trim(),0);}
            if(field==null){if(result.Fields.Count>0){var last=result.Fields[^1];result.Fields[^1]=last with{Value=last.Value+"\n"+raw};}else result.Warnings.Add("มีข้อความก่อนหัวข้อแรกที่อ่านไม่ได้");continue;}
            count.TryGetValue(field.Label,out var occurrence);count[field.Label]=++occurrence;result.Fields.Add(field with{Occurrence=occurrence});
        }
        foreach(var f in result.Fields)
        {
            if(f.Key.StartsWith("sn:")||f.Key is "oldSn" or "newSn")
            {
                if(f.Value is "" or "-")continue;
                var role=f.Key.StartsWith("sn:")?f.Key[3..]:"SN";result.Sns.Add(new(role,f.Value,f.Key=="oldSn"));
                if(!Regex.IsMatch(f.Value,@"^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$"))result.Warnings.Add("SN อ่านไม่ชัดหรือมีหลายบรรทัด: "+f.Label);
                continue;
            }
            if(f.Key.Length==0)continue;
            var value=f.Key=="date"?DateIso(f.Value):f.Value;
            if(semantic.TryGetValue(f.Key,out var existing)&&existing.Length>0&&value.Length>0&&existing!=value)result.Warnings.Add("ข้อมูลซ้ำและค่าต่างกัน: "+f.Label);
            if(!semantic.ContainsKey(f.Key)||semantic[f.Key].Length==0)semantic[f.Key]=value;
        }
        string Get(string key)=>semantic.GetValueOrDefault(key,"");
        result.JobDate=Get("date");result.CaseNo=Get("caseNo");result.OrderNo=Get("orderNo");result.Srt=Get("srt");result.Customer=Get("customer");
        if(result.JobDate.Length==0)result.Warnings.Add("วันที่งานไม่ถูกต้องหรือยังไม่ได้ระบุ");
        if(result.CaseNo.Length==0&&result.OrderNo.Length==0&&result.Srt.Length==0)result.Warnings.Add("ไม่มีเลขเคส Order หรือ SRT");
        if(new[]{result.CaseNo,result.OrderNo,result.Srt}.Any(s=>s.Length>100))result.Warnings.Add("เลขอ้างอิงยาวเกิน 100 ตัวอักษร");
        result.Warnings=result.Warnings.Distinct().ToList();return result;
    }
    public static string DateIso(string value)
    {
        var m=Regex.Match(value.Trim(),@"^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$");if(!m.Success)return "";
        int d=int.Parse(m.Groups[1].Value),month=int.Parse(m.Groups[2].Value),year=int.Parse(m.Groups[3].Value);if(m.Groups[3].Length==2)year+=1957;else if(year>2400)year-=543;
        if(year<1900||year>2200)return "";try{return new DateTime(year,month,d).ToString("yyyy-MM-dd",CultureInfo.InvariantCulture);}catch(ArgumentOutOfRangeException){return "";}
    }
}
