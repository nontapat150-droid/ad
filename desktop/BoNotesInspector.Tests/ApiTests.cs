using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using BoNotesInspector.Core;
using Xunit;
namespace BoNotesInspector.Tests;
public class ApiTests
{
    [Fact] public void ProductionRejectsPlainHttpAndEmbeddedCredentials(){Assert.Throws<ArgumentException>(()=>new NotesApiClient(new Uri("http://bonusais.com")));Assert.Throws<ArgumentException>(()=>new NotesApiClient(new Uri("https://user:pass@bonusais.com")));}
    [Fact] public async Task LoginPreviewAndUploadUseOnlyReviewEndpointsAndStableKey()
    {
        var received=new List<(string Path,string Body,string Auth)>();
        await using var server=new LocalServer(async c=>{var body=await new StreamReader(c.Request.InputStream).ReadToEndAsync();received.Add((c.Request.Url!.AbsolutePath,body,c.Request.Headers["Authorization"]??""));return c.Request.Url.AbsolutePath switch{
            "/api/auth/login"=>(200,"{\"token\":\"test-memory-token\",\"user\":{\"role\":\"admin\"}}"),
            "/api/line-import/settings"=>(200,"{\"users\":[{\"id\":1,\"full_name\":\"ช่างทดลอง\"}]}"),
            "/api/line-import/preview"=>(200,"{\"records\":[{\"warnings\":[]}]}"),
            _=>(200,"{\"records\":[{\"id\":77,\"version\":1,\"status\":\"review\"}],\"duplicate\":true}")};});
        using var api=new NotesApiClient(server.Uri,allowTestLoopback:true);await api.LoginAsync("test","test-password");Assert.Equal("ช่างทดลอง",Assert.Single(await api.LoadTechniciansAsync()).FullName);
        var batch=new DraftBatch{Group="กลุ่มทดสอบ"};var item=new DraftItem{Text="#งานMA",OriginalOcr="#งานMA",TechnicianId=1,EvidenceIds=["pic"]};batch.Items.Add(item);batch.Evidence.Add(new(){Id="pic",FileName="pic.png",Sha256=new string('A',64)});
        await api.PreviewAsync(item.Text);Assert.Equal(77,Assert.Single((await api.UploadAsync(batch,item)).Records).Id);await api.UploadAsync(batch,item);
        Assert.Equal(received[3].Body,received[4].Body);using var json=JsonDocument.Parse(received[3].Body);Assert.Equal(item.Id.ToString(),json.RootElement.GetProperty("itemId").GetString());Assert.Equal("กลุ่มทดสอบ",json.RootElement.GetProperty("source").GetProperty("group").GetString());Assert.Equal("",received[0].Auth);Assert.All(received.Skip(1),r=>Assert.Equal("Bearer test-memory-token",r.Auth));Assert.DoesNotContain(received.Skip(1),r=>r.Body.Contains("test-password"));Assert.DoesNotContain(received,r=>r.Path.Contains("process")||r.Path.Contains("inventory"));
    }
    [Fact] public async Task DeniedRoleWarningsAndRedirectNeverProceedToWrite()
    {
        await using var denied=new LocalServer(_=>Task.FromResult((200,"{\"token\":\"x\",\"user\":{\"role\":\"technician\"}}")));using var api=new NotesApiClient(denied.Uri,allowTestLoopback:true);await Assert.ThrowsAsync<InvalidOperationException>(()=>api.LoginAsync("test","test"));Assert.False(api.Connected);
        var calls=0;await using var redirect=new LocalServer(c=>{calls++;c.Response.RedirectLocation="http://127.0.0.1:1/stolen";return Task.FromResult((302,"{}"));});using var other=new NotesApiClient(redirect.Uri,allowTestLoopback:true);await Assert.ThrowsAsync<InvalidOperationException>(()=>other.LoginAsync("test","test"));Assert.Equal(1,calls);
        await using var warnings=new LocalServer(c=>Task.FromResult((200,c.Request.Url!.AbsolutePath.EndsWith("login")?"{\"token\":\"x\",\"user\":{\"roles\":[\"admin\"]}}":"{\"records\":[{\"warnings\":[\"SN ผิด\"]}]}")));using var third=new NotesApiClient(warnings.Uri,allowTestLoopback:true);await third.LoginAsync("test","test");await Assert.ThrowsAsync<InvalidOperationException>(()=>third.PreviewAsync("text"));
    }
    private sealed class LocalServer:IAsyncDisposable
    {
        private readonly HttpListener listener=new();private readonly Task worker;public Uri Uri{get;}
        public LocalServer(Func<HttpListenerContext,Task<(int,string)>> reply){var tcp=new TcpListener(IPAddress.Loopback,0);tcp.Start();var port=((IPEndPoint)tcp.LocalEndpoint).Port;tcp.Stop();Uri=new($"http://127.0.0.1:{port}/");listener.Prefixes.Add(Uri.ToString());listener.Start();worker=Task.Run(async()=>{try{while(listener.IsListening){var c=await listener.GetContextAsync();try{var(status,body)=await reply(c);c.Response.StatusCode=status;c.Response.ContentType="application/json; charset=utf-8";var bytes=Encoding.UTF8.GetBytes(body);await c.Response.OutputStream.WriteAsync(bytes);}finally{c.Response.Close();}}}catch(HttpListenerException){}catch(ObjectDisposedException){}});}
        public async ValueTask DisposeAsync(){listener.Close();await worker;}
    }
}

