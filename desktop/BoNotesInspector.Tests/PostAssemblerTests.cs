using BoNotesInspector.Core;
using Xunit;

public class PostAssemblerTests
{
    [Fact] public void HashtagWithinWhiteAttachmentCannotBecomeCompleteJob()
    {
        var a=new PostAssembler();a.Push(F("one",0,[L("#งานMA",180),L("Non : REAL0001",220),L("หมายเหตุ :",250),L("#งานMA",370),L("Non : PHOTO0002",400),L("หมายเหตุ :",430),L("3 hours ago",500),L("B",530),L("#งานMA",570),L("Non : REAL0003",600),L("หมายเหตุ :",630)],[new(290,330)]));
        Assert.DoesNotContain(a.Posts,p=>p.Text.Contains("PHOTO0002")&&p.Complete);
        Assert.Contains(a.Posts,p=>p.Text.Contains("REAL0003"));
    }
    // Catches joining two visible jobs into one and treating text inside attached photos as job fields.
    [Fact] public void AdjacentPostsStaySeparateAndPhotoTextIsNotImported()
    {
        var a = new PostAssembler();
        a.Push(F("one",0,[L("A",160),L("#งานMA",200),L("Non : 0001",230),L("หมายเหตุ :",260),L("SN ใหม่ : PHOTO-ONLY",330),L("3 hours ago",420),L("B",450),L("#งานMA",490),L("Non : 0002",520),L("หมายเหตุ :",550),L("2 hours ago",600)], [new(300,400)]));
        Assert.Equal(2,a.Posts.Count);
        Assert.Contains("0001",a.Posts[0].Text); Assert.DoesNotContain("0002",a.Posts[0].Text);
        Assert.DoesNotContain("PHOTO-ONLY",a.Posts[0].Text);
        Assert.True(a.Posts[0].Complete); Assert.True(a.Posts[1].Complete);
    }
    // Catches overlap losing an SN or treating the continued lower half as an independent ready job.
    [Fact] public void OverlapRetainsAllLinesAndEvidenceUntilVisibleEnd()
    {
        var a=new PostAssembler();
        a.Push(F("one",0,[L("A",160),L("#งานMA",200),L("Non : 0001",250),L("SN ใหม่ : 000ABC",500),L("วิธีแก้ไข : ตั้งค่า",540)]));
        Assert.False(Assert.Single(a.Posts).Complete);
        a.Push(F("two",1,[L("SN ใหม่ : 000ABC",150),L("วิธีแก้ไข : ตั้งค่า",190),L("ระยะสายที่ใช้ในงาน MA : 0",240),L("3 hours ago",290)]));
        var p=Assert.Single(a.Posts); Assert.True(p.Complete); Assert.Contains("000ABC",p.Text); Assert.Contains("ระยะสาย",p.Text);
        Assert.Equal(new[]{"one","two"},p.EvidenceIds); Assert.Equal(1,p.Text.Split("000ABC").Length-1);
    }
    // Catches accepting a collapsed or clipped Note as a complete source.
    [Fact] public void CollapsedAndMissingBeginningAreNeverComplete()
    {
        var a=new PostAssembler(); a.Push(F("one",0,[L("#งานMA",180),L("Non : 0001 ... See more",220),L("3 hours ago",270)]));
        Assert.False(Assert.Single(a.Posts).Complete);
        var b=new PostAssembler(); b.Push(F("two",0,[L("SN ใหม่ : 000ABC",180),L("3 hours ago",270)]));
        Assert.False(Assert.Single(b.Posts).Complete); Assert.False(b.Posts[0].HasStart);
    }
    // Catches silently dropping two genuinely distinct posts because they have the same text.
    [Fact] public void IdenticalPostsVisibleTogetherAreKeptAsSeparateCandidates()
    {
        var a=new PostAssembler(); a.Push(F("one",0,[L("#งานMA",180),L("Non : 0001",210),L("3 hours ago",250),L("#งานMA",350),L("Non : 0001",390),L("3 hours ago",430)]));
        Assert.Equal(2,a.Posts.Count);
    }
    // Catches merging unrelated fragments when visual overlap cannot prove continuity.
    [Fact] public void UnprovenContinuityRemainsSeparateAndUncertain()
    {
        var a=new PostAssembler();a.Push(F("one",0,[L("#งานMA",180),L("Non : 0001",220)]));
        a.Push(F("two",1,[L("SN ใหม่ : DIFFERENT",180),L("3 hours ago",220)]));
        Assert.Equal(2,a.Posts.Count); Assert.All(a.Posts,p=>Assert.False(p.Complete));
    }
    // Catches Thai diacritics OCR variance hiding a post boundary, without changing any source identifier.
    [Fact] public void DiacriticVariantTagAndTailRemainSourceTextButHaveRecognizedBoundaries()
    {
        var a=new PostAssembler();a.Push(F("one",0,[L("#ปีดงานติดตั้งais",180),L("Non : 0001",220),L("หมายเหต :",260),L("work order inside image",400),L("3 hours ago",550)],[new(300,350)]));
        var p=Assert.Single(a.Posts);Assert.True(p.Complete);Assert.StartsWith("#ปีดงาน",p.Text);Assert.DoesNotContain("inside image",p.Text);
    }
    [Fact] public void NotesValueAfterFinalLabelRemainsCompleteAndIsNotDropped()
    {
        var a=new PostAssembler();a.Push(F("one",0,[L("#งานMA",180),L("Non : 0001",220),L("หมายเหตุ :",260),L("ลูกค้าขอให้ติดต่อก่อน",290),L("3 hours ago",330)]));
        var p=Assert.Single(a.Posts);Assert.True(p.Complete);Assert.Contains("ลูกค้าขอให้ติดต่อก่อน",p.Text);
    }
    [Fact] public void FooterAfterPhotosCompletesAlreadyCapturedTextWithoutAddingPhotoWords()
    {
        var a=new PostAssembler();a.Push(F("one",0,[L("#งานMA",180),L("Non : 0001",220),L("หมายเหตุ :",260),L("-",290)]));
        a.Push(F("two",1,[L("photo text",170),L("3 hours ago",350)],[new(140,300)]));
        var p=Assert.Single(a.Posts);Assert.True(p.Complete);Assert.Equal("3 hours ago",p.PostedText);
    }
    private static TextLine L(string text,int y)=>new(text,15,y,300,18,90);
    private static CaptureFrame F(string id,int ordinal,TextLine[] lines,ImageBand[]? images=null)=>new(id,id,DateTimeOffset.Parse("2026-10-19T12:00:00Z"),ordinal,430,700,lines,images??[]);
}
