/* Customer QR links stay on the device. No HTTP or external rendering service. */
(() => {
  let previousLink = null, previousImage = null;
  window.RC_ORDERA_QR = Object.freeze({ image(link) {
    if (typeof link !== "string" || !link || link.length > 2048) throw new Error("INVALID_QR_LINK");
    if (link === previousLink) return previousImage;
    if (typeof qrcode !== "function") throw new Error("QR_RENDERER_UNAVAILABLE");
    qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
    const code = qrcode(0, "M"); code.addData(link, "Byte"); code.make();
    const image = code.createDataURL(4, 16);
    previousLink = link; previousImage = image;
    return image;
  }});
})();
