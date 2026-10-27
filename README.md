# Ecopontos Floripa

Mapa interativo para localizar ecopontos em Florianópolis, consultar informações de coleta e buscar endereços.

## Executar localmente

Como o aplicativo carrega módulos JavaScript e dados JSON, execute-o por um servidor HTTP local em vez de abrir `index.html` diretamente:

```powershell
python -m http.server 8000
```

Depois, acesse <http://localhost:8000>.

## Funcionalidades

- Mapa interativo com pontos de coleta e filtros por tipo.
- Busca de endereço e localização atual do usuário.
- Detalhes dos pontos, incluindo endereço, horário e link para rotas.
- Dados dos pontos mantidos em `data/dados.json`.

O mapa usa Leaflet e dados do OpenStreetMap. A busca de endereços usa o serviço Nominatim do OpenStreetMap; esses recursos precisam de conexão com a internet.

## Estrutura

- `index.html`, `css/`, `js/` e `data/`: aplicativo Ecopontos Floripa.
- `my-project/`: modelo independente de projeto TypeScript.
- `my-project-1/` e `my-project-2/`: modelos independentes de projetos JavaScript.

As pastas `my-project*` são exemplos/modelos e não são dependências do aplicativo principal.
