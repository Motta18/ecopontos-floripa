const URL_NOMINATIM = "https://nominatim.openstreetmap.org/search";
const INTERVALO_NOMINATIM_MS = 1100;
const resultadosEmCache = new Map();
let filaDeRequisicoes = Promise.resolve();
let instanteUltimaRequisicao = 0;

function requisitarComIntervalo(url) {
  const requisicao = filaDeRequisicoes.then(async () => {
    const espera = Math.max(
      0,
      INTERVALO_NOMINATIM_MS - (Date.now() - instanteUltimaRequisicao),
    );
    if (espera > 0) {
      await new Promise((resolve) => setTimeout(resolve, espera));
    }

    instanteUltimaRequisicao = Date.now();
    return fetch(url);
  });

  filaDeRequisicoes = requisicao.then(
    () => undefined,
    () => undefined,
  );
  return requisicao;
}

export async function localizarEndereco(endereco) {
  const enderecoNormalizado = endereco.trim();
  if (!enderecoNormalizado) {
    throw new Error("Informe um endereço para localizar.");
  }

  const chaveCache = enderecoNormalizado.toLocaleLowerCase("pt-BR");
  if (resultadosEmCache.has(chaveCache)) {
    return resultadosEmCache.get(chaveCache);
  }

  const consultaEndereco = /florian[oó]polis/i.test(enderecoNormalizado)
    ? enderecoNormalizado
    : `${enderecoNormalizado}, Florianópolis, SC, Brasil`;
  const consulta = new URLSearchParams({
    q: consultaEndereco,
    format: "jsonv2",
    limit: "1",
  });
  const consultaPendente = (async () => {
    const resposta = await requisitarComIntervalo(`${URL_NOMINATIM}?${consulta}`);
    if (!resposta.ok) {
      throw new Error("O serviço de busca de endereços está indisponível.");
    }

    const resultados = await resposta.json();
    if (!Array.isArray(resultados)) {
      throw new Error("A resposta da busca de endereços é inválida.");
    }
    if (resultados.length === 0) {
      return null;
    }

    const { lat, lon, display_name: nome } = resultados[0];
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (
      !Number.isFinite(latitude)
      || !Number.isFinite(longitude)
      || latitude < -90
      || latitude > 90
      || longitude < -180
      || longitude > 180
    ) {
      throw new Error("A busca retornou coordenadas inválidas.");
    }

    return { latitude, longitude, nome };
  })();

  resultadosEmCache.set(chaveCache, consultaPendente);
  try {
    const resultado = await consultaPendente;
    resultadosEmCache.set(chaveCache, resultado);
    return resultado;
  } catch (erro) {
    resultadosEmCache.delete(chaveCache);
    throw erro;
  }
}

function obterCoordenadasFallback(ponto) {
  const { latitude, longitude } = ponto;
  if (
    latitude === null
    || latitude === undefined
    || String(latitude).trim() === ""
    || longitude === null
    || longitude === undefined
    || String(longitude).trim() === ""
  ) {
    return null;
  }

  const latitudeNumerica = Number(latitude);
  const longitudeNumerica = Number(longitude);
  if (
    !Number.isFinite(latitudeNumerica)
    || !Number.isFinite(longitudeNumerica)
    || latitudeNumerica < -90
    || latitudeNumerica > 90
    || longitudeNumerica < -180
    || longitudeNumerica > 180
  ) {
    return null;
  }

  return { latitude: latitudeNumerica, longitude: longitudeNumerica };
}

export async function geocodificarPontos(pontos) {
  const pontosGeocodificados = [];
  const enderecosNaoEncontrados = [];
  const falhas = [];

  for (const [indice, ponto] of pontos.entries()) {
    const coordenadasFallback = obterCoordenadasFallback(ponto);
    const endereco = ponto.endereco || ponto.address;
    if (typeof endereco !== "string" || !endereco.trim()) {
      if (coordenadasFallback) {
        pontosGeocodificados.push({ ...ponto, ...coordenadasFallback, _id: indice });
      } else {
        enderecosNaoEncontrados.push(ponto.nome || "Ponto sem nome ou endereço");
      }
      continue;
    }

    try {
      let resultado = await localizarEndereco(endereco);
      if (!resultado && ponto.nome) {
        resultado = await localizarEndereco(`${ponto.nome}, ${endereco}`);
      }
      if (resultado) {
        pontosGeocodificados.push({
          ...ponto,
          latitude: resultado.latitude,
          longitude: resultado.longitude,
          _id: indice,
        });
      } else if (coordenadasFallback) {
        pontosGeocodificados.push({ ...ponto, ...coordenadasFallback, _id: indice });
      } else {
        enderecosNaoEncontrados.push(ponto.nome || endereco);
      }
    } catch (erro) {
      if (coordenadasFallback) {
        pontosGeocodificados.push({ ...ponto, ...coordenadasFallback, _id: indice });
      } else {
        falhas.push({
          nome: ponto.nome || endereco,
          erro: erro instanceof Error ? erro.message : "Falha desconhecida na geocodificação.",
        });
      }
    }
  }

  return { pontos: pontosGeocodificados, enderecosNaoEncontrados, falhas };
}