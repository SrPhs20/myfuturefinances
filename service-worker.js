const CACHE_NAME = "my-future-finances-v47";
const APP_SHELL = ["/", "/index.html", "/style.css?v=43", "/script.js?v=42", "/manifest.json", "/icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  if (url.pathname.endsWith("/script.js") || url.pathname.endsWith("/style.css")) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }))
  );
});

/* Notificações push de vencimento (contas fixas e faturas de cartão).
   Quem envia é a Edge Function check-vencimentos, chamada de fora do app
   duas vezes ao dia; aqui só recebemos e exibimos. */
self.addEventListener("push", event => {
  let dados = { title: "Minhas Finanças", body: "Você tem um vencimento próximo." };
  try {
    if (event.data) dados = { ...dados, ...event.data.json() };
  } catch {
    // payload sem JSON válido: mantém o texto padrão.
  }

  event.waitUntil(
    self.registration.showNotification(dados.title, {
      body: dados.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: "mf-vencimento",
      renotify: true
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(listaClientes => {
      for (const cliente of listaClientes) {
        if ("focus" in cliente) return cliente.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
