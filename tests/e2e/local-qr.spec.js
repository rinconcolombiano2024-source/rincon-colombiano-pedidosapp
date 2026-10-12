const {test,expect}=require('@playwright/test');
const jsQR=require('jsqr');
const {installSupabaseMock}=require('./support/supabase-mock.cjs');
test('local QR decodes to the exact customer URL without a third-party request',async({page})=>{
 await installSupabaseMock(page);const requests=[];page.on('request',r=>{if(r.url().includes('qrserver'))requests.push(r.url());});
 await page.goto('/restaurante.html');const result=await page.evaluate(async()=>{
  cloudState.user={id:'11111111-1111-4111-8111-111111111111'};elements.qrTableInput.value='Łódź Bogotá 7';updateQrPreview();
  const img=elements.qrImage;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  const c=canvas.getContext('2d');c.drawImage(img,0,0);return {width:canvas.width,height:canvas.height,pixels:Array.from(c.getImageData(0,0,canvas.width,canvas.height).data),link:elements.qrLinkInput.value,src:img.src};
 });
 expect(result.src).toMatch(/^data:image\/gif;base64,/);expect(jsQR(new Uint8ClampedArray(result.pixels),result.width,result.height)?.data).toBe(result.link);expect(requests).toEqual([]);
});
