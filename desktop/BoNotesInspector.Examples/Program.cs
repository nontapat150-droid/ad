using BoNotesInspector.Core;
var batch=new DraftBatch{Group="ข้อมูลจำลองสำหรับทดลองโปรแกรม — ไม่ใช่งานจริง",CreatedAt=DateTimeOffset.Parse("2026-10-19T12:00:00Z")};
string[] texts=[
"#ปิดงานติดตั้งais\nวันที่ติดตั้ง : 18/10/69\nปิดเคสงาน : 0088000011\nOrder no : P-DEMO-0001\nOrder Type : New Connection\nชื่อ-สกุล : ลูกค้าตัวอย่าง AIS\nแพ็กเกจ : ตัวอย่าง 500/500 Mbps\nปิดSOA :\nSn Playbox : DEMO-PB-001\nSn ONU : DEMO-ONU-001\nSn Mesh :\nหมายเหตุ : ข้อมูลจำลอง",
"#ปิดงานติดตั้ง3bb\nวันที่ติดตั้ง : 18-10-69\nปิดเคสงาน : 0088000012\norder no : P-DEMO-0002\norder type : New connection\nชื่อ-สกุล : ลูกค้าตัวอย่าง 3BB\nแพ็กเกจหลัก : ตัวอย่าง 1000/500 Mbps\nอุปกรณร์ปิดSOA : Active+FibreHome\nSn ONU : : DEMO-ONU-002\nSn ONU : DEMO-ONU-EXTRA\nSplitter : 0000_DEMO_01\nใช้ Port : 1\nหมายเหตุ : =ข้อความนี้เก็บเป็นข้อความ ไม่ใช่สูตร",
"#ปิดงานเปลี่ยนอุปกรณ์3bb\nวันที่ติดตั้ง : 19-10-69\nปิดเคสงาน : 0088000013\norder no : P-DEMO-0003\norder type : Change Home Device\nชื่อ-สกุล : ลูกค้าตัวอย่างเปลี่ยนอุปกรณ์\nSn ONU : DEMO-ONU-003\nSn Mesh เช่า :\nหมายเหตุ : ข้อมูลจำลอง",
"#งานMA\nวันที่แก้ไข :19/10/69\nNon :0088000014\nSRT :2026101900000001\nชื่อลูกค้า ลูกค้าตัวอย่าง MA\nโครงข่าย AIS\nสาเหตุ ทดสอบข้อมูล\nวิธีแก้ไข ตั้งค่าอุปกรณ์\nอุปกรณ์ที่ใช้ :-\nSN เก่า : DEMO-OLD-001\nSN ใหม่ : DEMO-NEW-001\nระยะสายที่ใช้ในงาน MA New/MA Splice :0",
"#บันทึกเพิ่มเติม\nรายละเอียด : ข้อมูลที่ยังไม่ทราบประเภท ต้องตรวจต้นฉบับก่อนนำเข้า"
];
foreach(var text in texts)batch.Items.Add(new(){OriginalOcr=text,Text=text,Selected=true,Author="ผู้โพสต์ตัวอย่าง",PostedText="18 hours ago (ข้อความตัวอย่าง)",CapturedAt=DateTimeOffset.Parse("2026-10-19T12:00:00Z"),TechnicianName="ยังไม่กำหนดช่าง",SourceComplete=true});
var output=args.Length>0?Path.GetFullPath(args[0]):Path.Combine(Environment.CurrentDirectory,"BO-Notes-Example.xlsx");var receipt=WorkbookWriter.Export(batch,batch.Items.Select(i=>i.Id),output);Console.WriteLine(output);Console.WriteLine("SHA256 "+receipt.FileHash);
