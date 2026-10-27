import { geocodificarPontos, localizarEndereco } from "./geocode.js";
import { adicionarMarcadores, escapeHtml } from "./marcadores.js";

const CENTRO_FLORIANOPOLIS = [-27.5954, -48.548];
const mensagem = document.querySelector("#mensagem");
const listaPontos = document.querySelector("#lista-pontos");
const totalPontos = document.querySelector("#total-pontos");
const formularioBusca = document.querySelector("#form-busca");
const campoEndereco = document.querySelector("#endereco");
const botaoBusca = formularioBusca.querySelector("button");
const botaoAtualizar = document.querySelector("#atualizar");
const mapa = L.map("mapa").setView(CENTRO_FLORIANOPOLIS, 12);
const camadaEcopontos = L.layerGroup().addTo(mapa);
const camadaBusca = L.layerGroup().addTo(mapa);
let circuloLocalizacao = null;
let marcadorLocalizacao = null;
let marcadores = [];

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(mapa);
L.control.scale({ imperial: false }).addTo(mapa);

function criarBotaoLocalizacao() {
  const controle = L.control({ position: "topleft" });

  mapa.on("locationfound", (evento) => {
    if (circuloLocalizacao) mapa.removeLayer(circuloLocalizacao);
    if (marcadorLocalizacao) mapa.removeLayer(marcadorLocalizacao);
    circuloLocalizacao = L.circle(evento.latlng, {
      radius: evento.accuracy / 2,
      color: "#1565c0",
      fillOpacity: 0.2,
    }).addTo(mapa);
    marcadorLocalizacao = L.marker(evento.latlng)
      .addTo(mapa)
      .bindPopup("Você está aqui");
  });

  mapa.on("locationerror", () => {
    exibirMensagem("Não foi possível obter sua localização.", true);
  });

  controle.onAdd = () => {
    const botao = L.DomUtil.create("button", "botao-localizacao");
    botao.type = "button";
    botao.textContent = "📍 Onde estou";
    botao.addEventListener("click", (evento) => {
      L.DomEvent.stopPropagation(evento);
      circuloLocalizacao?.remove();
      marcadorLocalizacao?.remove();
      circuloLocalizacao = null;
      marcadorLocalizacao = null;
      mapa.locate({ setView: true, maxZoom: 16 });
    });
    return botao;
  };

  return controle;
}

criarBotaoLocalizacao().addTo(mapa);

function haversine(lat1, lon1, lat2, lon2) {
  const raioTerra = 6371000;
  const radianos = (graus) => (graus * Math.PI) / 180;
  const diferencaLatitude = radianos(lat2 - lat1);
  const diferencaLongitude = radianos(lon2 - lon1);
  const a = Math.sin(diferencaLatitude / 2) ** 2
    + Math.cos(radianos(lat1))
      * Math.cos(radianos(lat2))
      * Math.sin(diferencaLongitude / 2) ** 2;

  const aLimitado = Math.min(1, a);
  return 2 * raioTerra * Math.atan2(Math.sqrt(aLimitado), Math.sqrt(1 - aLimitado));
}

function criarBotaoProximo() {
  const controle = L.control({ position: "topright" });

  controle.onAdd = () => {
    const botao = L.DomUtil.create("button", "botao-proximo");
    botao.type = "button";
    botao.textContent = "🎯 Mais próximo";
    botao.addEventListener("click", (evento) => {
      L.DomEvent.stopPropagation(evento);
      if (!navigator.geolocation) {
        exibirMensagem("Não foi possível obter sua localização.", true);
        return;
      }
      const marcadoresVisiveis = marcadores.filter(
        ({ marcador }) => marcador.options.opacity !== 0,
      );
      if (marcadoresVisiveis.length === 0) {
        exibirMensagem("Nenhum ecoponto visível no mapa.", true);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const pontosVisiveis = marcadores.filter(
            ({ marcador }) => marcador.options.opacity !== 0,
          );
          if (pontosVisiveis.length === 0) {
            exibirMensagem("Nenhum ecoponto visível no mapa.", true);
            return;
          }

          const maisProximo = pontosVisiveis.reduce((melhor, item) => {
            const distancia = haversine(
              coords.latitude,
              coords.longitude,
              item.coordenadas[0],
              item.coordenadas[1],
            );
            return !melhor || distancia < melhor.distancia
              ? { ...item, distancia }
              : melhor;
          }, null);
          const distanciaFormatada = maisProximo.distancia < 1000
            ? `${Math.round(maisProximo.distancia)} m`
            : `${(maisProximo.distancia / 1000).toFixed(1)} km`;

          mapa.setView(maisProximo.coordenadas, 17);
          maisProximo.marcador.openPopup();
          exibirMensagem(
            `Ecoponto mais próximo: ${maisProximo.ponto.nome || "Ecoponto"} (${distanciaFormatada})`,
          );
        },
        () => {
          exibirMensagem("Não foi possível obter sua localização.", true);
        },
      );
    });
    return botao;
  };

  return controle;
}

criarBotaoProximo().addTo(mapa);
criarLegenda().addTo(mapa);

function criarLegenda() {
  const controle = L.control({ position: "bottomright" });
  const categorias = [
    { emoji: "♻", nome: "Ecoponto", classe: "ecoponto" },
    { emoji: "♻", nome: "Reciclável", classe: "reciclavel" },
    { emoji: "🔋", nome: "Pilhas", classe: "pilhas" },
    { emoji: "💻", nome: "Eletrônicos", classe: "eletronicos" },
    { emoji: "🛢", nome: "Óleo", classe: "oleo" },
    { emoji: "🍾", nome: "Vidro", classe: "vidro" },
    { emoji: "📄", nome: "Papel", classe: "papel" },
    { emoji: "🥤", nome: "Plástico", classe: "plastico" },
  ];

  controle.onAdd = () => {
    const container = L.DomUtil.create("div", "legenda-mapa");
    L.DomEvent.disableClickPropagation(container);
    const titulo = L.DomUtil.create("strong", "legenda-titulo", container);
    titulo.textContent = "Legenda";
    const lista = L.DomUtil.create("ul", "legenda-lista", container);

    categorias.forEach(({ emoji, nome, classe }) => {
      const item = L.DomUtil.create("li", "legenda-item", lista);
      const icone = L.DomUtil.create("span", "legenda-icone", item);
      icone.textContent = emoji;
      const cor = L.DomUtil.create("span", `legenda-cor legenda-cor--${classe}`, item);
      cor.setAttribute("aria-hidden", "true");
      const texto = L.DomUtil.create("span", "legenda-texto", item);
      texto.textContent = nome;
    });

    return container;
  };

  return controle;
}

function exibirMensagem(texto, erro = false) {
  mensagem.textContent = texto;
  mensagem.classList.toggle("mensagem--erro", erro);
}

function mostrarPontos(pontos, marcadores) {
  totalPontos.textContent = String(pontos.length);
  listaPontos.replaceChildren();

  if (pontos.length === 0) {
    const vazio = document.createElement("li");
    vazio.className = "lista-vazia";
    vazio.textContent = "Nenhum ecoponto cadastrado ainda. Adicione pontos em data/dados.json.";
    listaPontos.append(vazio);
    return;
  }

  pontos.forEach((ponto, indice) => {
    const item = document.createElement("li");
    item.className = "item-ponto";

    const titulo = document.createElement("h3");
    titulo.textContent = ponto.nome || `Ecoponto ${indice + 1}`;
    item.append(titulo);

    const endereco = ponto.endereco || ponto.address;
    if (endereco) {
      const descricao = document.createElement("p");
      descricao.textContent = endereco;
      item.append(descricao);
    }

    const itemGeocodificado = marcadores.find((marcador) => marcador._id === indice);
    if (itemGeocodificado) {
      const botao = document.createElement("button");
      botao.className = "botao-ponto";
      botao.type = "button";
      botao.textContent = "Ver no mapa";
      botao.addEventListener("click", () => {
        mapa.setView(itemGeocodificado.coordenadas, 16);
        itemGeocodificado.marcador.openPopup();
      });
      item.append(botao);
    } else {
      const aviso = document.createElement("span");
      aviso.className = "aviso-geocode";
      aviso.textContent = "Localização não encontrada";
      item.append(aviso);
    }

    listaPontos.append(item);
  });
}

function criarPainelFiltros(marcadores) {
  const normalizarTipo = (tipo) => String(tipo || "outro")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/eis$/, "el")
    .replace(/s$/, "");
  const obterCategoria = (ponto) => ponto.tipo || ponto.nome || "outro";
  const nomesAmigaveis = {
    ecoponto: "Ecoponto",
    reciclavel: "Reciclável",
    pilha: "Pilhas",
    eletronico: "Eletrônicos",
    oleo: "Óleo",
    vidro: "Vidro",
    papel: "Papel",
    plastico: "Plástico",
    outro: "Outro",
  };
  const tipos = new Map();

  marcadores.forEach(({ ponto }) => {
    const tipoOriginal = String(obterCategoria(ponto)).trim() || "outro";
    const tipoNormalizado = normalizarTipo(tipoOriginal);
    if (!tipos.has(tipoNormalizado)) {
      const nome = nomesAmigaveis[tipoNormalizado]
        || `${tipoOriginal.charAt(0).toLocaleUpperCase("pt-BR")}${tipoOriginal.slice(1)}`;
      tipos.set(tipoNormalizado, nome);
    }
  });

  listaPontos.parentElement.querySelector(".painel-filtros")?.remove();
  const painel = document.createElement("div");
  painel.className = "painel-filtros";

  const cabecalho = document.createElement("div");
  cabecalho.className = "painel-filtros__cabecalho";
  const titulo = document.createElement("strong");
  titulo.textContent = "Filtrar por tipo";
  const resumo = document.createElement("span");
  resumo.className = "filtro-resumo";
  resumo.id = "contador-filtros";
  cabecalho.append(titulo, resumo);
  painel.append(cabecalho);

  const opcoes = document.createElement("div");
  opcoes.className = "painel-filtros__opcoes";
  tipos.forEach((nome, tipo) => {
    const label = document.createElement("label");
    label.className = "filtro-opcao";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "filtro-checkbox";
    checkbox.value = tipo;
    checkbox.checked = true;
    const texto = document.createElement("span");
    texto.textContent = nome;
    label.append(checkbox, texto);
    opcoes.append(label);
  });
  painel.append(opcoes);
  listaPontos.parentElement.insertBefore(painel, listaPontos);

  const checkboxes = [...painel.querySelectorAll(".filtro-checkbox")];
  const atualizarVisibilidade = () => {
    const tiposVisiveis = new Set(
      checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value),
    );
    let totalVisiveis = 0;

    marcadores.forEach(({ ponto, marcador }) => {
      const visivel = tiposVisiveis.has(normalizarTipo(obterCategoria(ponto)));
      marcador.setOpacity(visivel ? 1 : 0);
      const elemento = marcador.getElement();
      if (elemento) {
        elemento.style.pointerEvents = visivel ? "auto" : "none";
      }
      if (visivel) totalVisiveis += 1;
    });

    resumo.textContent = `${totalVisiveis} de ${marcadores.length} ecopontos visíveis`;
  };

  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", atualizarVisibilidade);
  });
  atualizarVisibilidade();
}

async function carregarPontos() {
  botaoAtualizar.disabled = true;
  exibirMensagem("Carregando e localizando endereços dos ecopontos...");

  const urlDados = new URL("../data/dados.json", import.meta.url);
  try {
    const resposta = await fetch(urlDados, { cache: "no-store" });
    if (!resposta.ok) {
      throw new Error(`Não foi possível carregar data/dados.json (HTTP ${resposta.status}).`);
    }

    const dados = await resposta.json();
    if (!Array.isArray(dados)) {
      throw new Error("data/dados.json deve conter uma lista de ecopontos.");
    }

    const pontos = dados.filter((ponto) => ponto && typeof ponto === "object" && !Array.isArray(ponto));
    const resultadoGeocodificacao = await geocodificarPontos(pontos);

    camadaEcopontos.clearLayers();
    camadaBusca.clearLayers();
    marcadores = adicionarMarcadores(camadaEcopontos, resultadoGeocodificacao.pontos)
      .map((marcador) => ({ ...marcador, _id: marcador.ponto._id }));
    mostrarPontos(pontos, marcadores);
    criarPainelFiltros(marcadores);

    if (marcadores.length > 0) {
      const limites = L.latLngBounds(marcadores.map(({ coordenadas }) => coordenadas));
      mapa.fitBounds(limites, { padding: [36, 36], maxZoom: 15 });
    }

    const totalProblemas = resultadoGeocodificacao.enderecosNaoEncontrados.length
      + resultadoGeocodificacao.falhas.length;
    if (totalProblemas > 0) {
      console.warn("Alguns ecopontos não puderam ser localizados:", resultadoGeocodificacao);
      const detalhesPendencias = [
        ...resultadoGeocodificacao.enderecosNaoEncontrados,
        ...resultadoGeocodificacao.falhas.map(({ nome }) => nome),
      ].join(", ");
      exibirMensagem(
        `${marcadores.length} ecoponto(s) no mapa. Não localizados: ${detalhesPendencias}.`,
        true,
      );
    } else {
      exibirMensagem(`${marcadores.length} ecoponto(s) carregado(s).`);
    }
  } finally {
    botaoAtualizar.disabled = false;
  }
}

botaoAtualizar.addEventListener("click", () => {
  carregarPontos().catch((erro) => {
    console.error("Falha ao atualizar ecopontos:", erro);
    exibirMensagem(
      erro instanceof Error ? erro.message : "Não foi possível atualizar os ecopontos.",
      true,
    );
  });
});

formularioBusca.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const endereco = campoEndereco.value.trim();
  if (!endereco) {
    return;
  }

  botaoBusca.disabled = true;
  exibirMensagem("Buscando endereço...");
  try {
    const resultado = await localizarEndereco(endereco);
    if (!resultado) {
      exibirMensagem("Endereço não encontrado. Tente informar outro local.", true);
      return;
    }

    camadaBusca.clearLayers();
    const latitude = resultado.latitude.toFixed(5);
    const longitude = resultado.longitude.toFixed(5);
    const nome = escapeHtml(resultado.nome || endereco);
    const destino = `${latitude},${longitude}`;
    const popup = `
      <div>
        <strong>${nome}</strong>
        <p>${latitude}, ${longitude}</p>
        <a href="https://www.google.com/maps/dir/?api=1&amp;destination=${destino}"
           target="_blank" rel="noopener">📍 Como chegar</a>
      </div>
    `;

    mapa.setView([resultado.latitude, resultado.longitude], 16);
    L.marker([resultado.latitude, resultado.longitude])
      .addTo(camadaBusca)
      .bindPopup(popup)
      .openPopup();
    exibirMensagem("Endereço localizado no mapa.");
  } catch (erro) {
    exibirMensagem(erro instanceof Error ? erro.message : "Não foi possível localizar o endereço.", true);
  } finally {
    botaoBusca.disabled = false;
  }
});

carregarPontos().catch((erro) => {
  console.error("Falha ao carregar ecopontos:", erro);
  exibirMensagem(
    erro instanceof Error
      ? `${erro.message} Confira se a página foi aberta por um servidor local.`
      : "Não foi possível carregar os ecopontos. Confira se a página foi aberta por um servidor local.",
    true,
  );
});