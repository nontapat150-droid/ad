using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
namespace BoNotesInspector.Core;
public sealed record ApiRecord(long Id,int Version,string Status);
public sealed record ApiReceipt(List<ApiRecord> Records,bool Duplicate);
public sealed class NotesApiClient:IDisposable
{
    private readonly HttpClient http;private string? token;public bool Connected=>token!=null;
    private static readonly JsonSerializerOptions JsonOptions=new(){PropertyNameCaseInsensitive=true};
    public NotesApiClient(Uri uri,bool allowTestLoopback=false)
    {
        if(!uri.IsAbsoluteUri||uri.UserInfo.Length>0||uri.Query.Length>0||uri.Fragment.Length>0||uri.AbsolutePath!="/"||(uri.Scheme!="https"&&!(allowTestLoopback&&uri.Scheme=="http"&&uri.IsLoopback)))throw new ArgumentException("ระบุเว็บไซต์ HTTPS เช่น https://bonusais.com");
        http=new(new HttpClientHandler{AllowAutoRedirect=false}){BaseAddress=uri,Timeout=TimeSpan.FromSeconds(45)};
    }
    private async Task<JsonElement> SendAsync(string path,object? body=null,bool authenticated=true,CancellationToken ct=default)
    {
        if(authenticated&&token==null)throw new InvalidOperationException("กรุณาเชื่อมบัญชีผู้ดูแลก่อน");
        using var request=new HttpRequestMessage(body==null?HttpMethod.Get:HttpMethod.Post,path);if(body!=null)request.Content=JsonContent.Create(body);if(authenticated)request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",token);
        using var response=await http.SendAsync(request,HttpCompletionOption.ResponseHeadersRead,ct).ConfigureAwait(false);
        // Bound server responses before parsing. Never include login credentials or request text in errors.
        await using var stream=await response.Content.ReadAsStreamAsync(ct).ConfigureAwait(false);using var memory=new MemoryStream();var buffer=new byte[8192];int read;while((read=await stream.ReadAsync(buffer,ct).ConfigureAwait(false))>0){if(memory.Length+read>4_000_000)throw new InvalidOperationException("คำตอบจากเว็บไซต์มีขนาดเกินกำหนด");await memory.WriteAsync(buffer.AsMemory(0,read),ct).ConfigureAwait(false);}
        if(!response.IsSuccessStatusCode){if(response.StatusCode==System.Net.HttpStatusCode.Unauthorized)token=null;var error="เว็บไซต์ตอบสถานะ "+(int)response.StatusCode;try{using var e=JsonDocument.Parse(memory.ToArray());if(e.RootElement.TryGetProperty("error",out var msg)&&msg.ValueKind==JsonValueKind.String)error=msg.GetString()![..Math.Min(msg.GetString()!.Length,700)];}catch(JsonException){}throw new InvalidOperationException(error);}
        try{using var document=JsonDocument.Parse(memory.ToArray());return document.RootElement.Clone();}catch(JsonException){throw new InvalidOperationException("เว็บไซต์ไม่ได้ส่งข้อมูล JSON ที่รองรับ");}
    }
    public async Task LoginAsync(string username,string password,CancellationToken ct=default)
    {
        token=null;var result=await SendAsync("/api/auth/login",new{username,password},false,ct).ConfigureAwait(false);var user=result.GetProperty("user");var roles=new List<string>();if(user.TryGetProperty("roles",out var values)&&values.ValueKind==JsonValueKind.Array)roles.AddRange(values.EnumerateArray().Where(v=>v.ValueKind==JsonValueKind.String).Select(v=>v.GetString()!));if(user.TryGetProperty("role",out var role)&&role.ValueKind==JsonValueKind.String)roles.Add(role.GetString()!);
        if(!roles.Any(r=>r is "admin" or "super_admin"))throw new InvalidOperationException("ต้องใช้บัญชีผู้ดูแล BO ad");if(!result.TryGetProperty("token",out var t)||string.IsNullOrWhiteSpace(t.GetString()))throw new InvalidOperationException("เว็บไซต์ไม่ส่ง token เข้าสู่ระบบ");token=t.GetString();
    }
    public async Task<List<Technician>> LoadTechniciansAsync(CancellationToken ct=default){var r=await SendAsync("/api/line-import/settings",ct:ct).ConfigureAwait(false);return r.GetProperty("users").EnumerateArray().Select(u=>new Technician(u.GetProperty("id").GetInt32(),u.GetProperty("full_name").GetString()??"")).ToList();}
    public async Task PreviewAsync(string text,CancellationToken ct=default){var r=await SendAsync("/api/line-import/preview",new{text},ct:ct).ConfigureAwait(false);var records=r.GetProperty("records");if(records.GetArrayLength()!=1)throw new InvalidOperationException("เว็บไซต์ต้องอ่านได้เพียงงานเดียวต่อรายการ");var errors=records[0].GetProperty("warnings").EnumerateArray().Select(w=>w.GetString()).ToArray();if(errors.Length>0)throw new InvalidOperationException("กรุณาแก้ข้อมูลก่อนนำเข้า: "+string.Join("; ",errors));}
    public async Task<ApiReceipt> UploadAsync(DraftBatch batch,DraftItem item,CancellationToken ct=default)
    {
        var hashes=item.EvidenceIds.Select(id=>batch.Evidence.Single(e=>e.Id==id).Sha256).Distinct().OrderBy(h=>h).ToArray();
        var r=await SendAsync("/api/line-import/desktop/items",new{batchId=batch.Id,itemId=item.Id,revision=item.Revision,technicianId=item.TechnicianId,text=item.Text,source=new{group=batch.Group,author=item.Author,postedText=item.PostedText,capturedAt=item.CapturedAt.ToString("O"),evidenceHashes=hashes,originalOcr=item.OriginalOcr}},ct:ct).ConfigureAwait(false);return r.Deserialize<ApiReceipt>(JsonOptions)??throw new InvalidOperationException("ไม่ได้รับใบรับรายการ");
    }
    public void Dispose(){token=null;http.Dispose();}
}
