// Resell Ready: receives photos shared from WhatsApp or the gallery (Android) and hands them to the upload page.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "POST" || !u.pathname.endsWith("/add.html") || !u.searchParams.has("share")) return;
  e.respondWith((async () => {
    try {
      const form = await e.request.formData();
      const c = await caches.open("rr-share");
      let i = 0;
      for (const f of form.getAll("media")) {
        if (!(f instanceof File)) continue;
        await c.put(new URL(`__share/${Date.now()}-${i++}`, self.registration.scope).href,
          new Response(f, { headers: { "Content-Type": f.type || "application/octet-stream", "x-name": encodeURIComponent(f.name || "photo") } }));
      }
    } catch (err) { console.error(err); }
    return Response.redirect(new URL("add.html?share=1", self.registration.scope).href, 303);
  })());
});
