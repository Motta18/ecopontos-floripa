export function escapeHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (caractere) => {
    const entidades = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entidades[caractere];
  });
}

export const TIPOS_ESTILO = {
  ecoponto: { icone: "♻", classe: "ecoponto" },
  reciclavel: { icone: "♻", classe: "reciclavel" },
  "reciclável": { icone: "♻", classe: "reciclavel" },
  pilhas: { icone: "🔋", classe: "pilhas" },
  eletronicos: { icone: "💻", classe: "eletronicos" },
  "eletrônicos": { icone: "💻", classe: "eletronicos" },
  oleo: { icone: "🛢", classe: "oleo" },
  "óleo": { icone: "🛢", classe: "oleo" },
  vidro: { icone: "🍾", classe: "vidro" },
  papel: { icone: "📄", classe: "papel" },
  plastico: { icone: "🥤", classe: "plastico" },
  "plástico": { icone: "🥤", classe: "plastico" },
};

function resolverEstiloTipo(ponto) {
  const tipoOriginal = String(ponto.tipo || "default").toLowerCase();
  const tipoLimpo = tipoOriginal
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/eis$/, "el")
    .replace(/s$/, "");

  const tiposEstiloNormalizados = {
    ecoponto: { icone: "♻", classe: "ecoponto" },
    reciclavel: { icone: "♻", classe: "reciclavel" },
    pilha: { icone: "🔋", classe: "pilhas" },
    eletronico: { icone: "💻", classe: "eletronicos" },
    oleo: { icone: "🛢", classe: "oleo" },
    vidro: { icone: "🍾", classe: "vidro" },
    papel: { icone: "📄", classe: "papel" },
    plastico: { icone: "🥤", classe: "plastico" },
  };

  return tiposEstiloNormalizados[tipoLimpo]
    || { icone: "♻", classe: "ecoponto" };
}

function obterCoordenadas(ponto) {
  const latitudeOriginal = ponto.latitude ?? ponto.lat;
  const longitudeOriginal = ponto.longitude ?? ponto.lon ?? ponto.lng;
  if (
    latitudeOriginal === null
    || latitudeOriginal === undefined
    || String(latitudeOriginal).trim() === ""
    || longitudeOriginal === null
    || longitudeOriginal === undefined
    || String(longitudeOriginal).trim() === ""
  ) {
    return null;
  }

  const latitude = Number(latitudeOriginal);
  const longitude = Number(longitudeOriginal);

  if (
    !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    return null;
  }

  return [latitude, longitude];
}

function criarPopup(ponto) {
  const { classe } = resolverEstiloTipo(ponto);
  const nome = escapeHtml(ponto.nome || "Ecoponto");
  const tipo = escapeHtml(ponto.tipo || "outro");
  const endereco = ponto.endereco || ponto.address;
  const informacao = ponto.infoAdicional || ponto.info || ponto.informacao;
  const coordenadas = obterCoordenadas(ponto);
  const linhasAdicionais = [
    endereco
      ? `<p class="popup-endereco">${escapeHtml(endereco)}</p>`
      : "",
    informacao
      ? `<p class="popup-info">${escapeHtml(informacao)}</p>`
      : "",
  ].join("");
  const linkComoChegar = coordenadas
    ? `<a class="popup-link" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&amp;destination=${coordenadas[0]},${coordenadas[1]}">📍 Como chegar</a>`
    : "";

  return `
    <div class="popup-ecoponto">
      <strong>${nome}</strong>
      <span class="popup-badge popup-badge--${classe}">${tipo}</span>
      ${linhasAdicionais}
      ${linkComoChegar}
    </div>
  `;
}

function criarIcone(ponto) {
  const estilo = resolverEstiloTipo(ponto);
  return L.divIcon({
    className: `icone-mapa icone-mapa--${estilo.classe}`,
    html: `<div style="transform: rotate(45deg); font-size: 20px; color: #ffffff; line-height: 1;">${estilo.icone}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 34],
    popupAnchor: [0, -32],
  });
}

function criarTooltip(ponto) {
  const tooltip = document.createElement("span");
  tooltip.className = "leaflet-tooltip-tipo";
  tooltip.textContent = `${ponto.tipo || "Outro"} · ${ponto.nome || "Ecoponto"}`;
  return tooltip;
}

export function adicionarMarcadores(camada, pontos, aoSelecionar) {
  const marcadores = [];

  pontos.forEach((ponto) => {
    const coordenadas = obterCoordenadas(ponto);
    if (!coordenadas) {
      console.warn("Ecoponto ignorado por não ter coordenadas válidas:", ponto);
      return;
    }

    const marcador = L.marker(coordenadas, { icon: criarIcone(ponto) })
      .addTo(camada)
      .bindPopup(criarPopup(ponto))
      .bindTooltip(criarTooltip(ponto), { direction: "top", offset: [0, -24] });
    marcador.on("click", () => aoSelecionar?.(ponto));
    marcadores.push({ ponto, marcador, coordenadas, _id: ponto._id });
  });

  return marcadores;
}
