# Winner Capital · site

Site de uma página da Winner Capital (planejamento financeiro e estratégico, alavancagem patrimonial, crédito inteligente e consórcio estruturado). O vídeo da bola de ouro avança quando o visitante rola a página para baixo e volta quando ele rola para cima.

HTML, CSS e JavaScript puros. Sem build, sem dependências.

```
site/                  ← a pasta que vai para o ar (só ela)
  index.html
  assets/
    styles.css
    main.js
    hero-scrub.mp4     ← o vídeo enviado, re-encodado para o scroll (keyframe a cada 8 quadros, sem áudio)
    hero-scrub-retrato.mp4 ← recorte central 576x720 para celular e tablet em pé (keyframe a cada 4 quadros)
    hero-poster.jpg    ← primeiro quadro
    hero-ending.jpg    ← quadro final (bola na linha)
    impacto.jpg        ← quadro do impacto com a poeira de ouro
PACOTE-DE-DESIGN.md    ← as decisões de design (não vai para o ar)
```

## Ver no computador

Dar dois cliques no `index.html` mostra a versão com imagem parada, porque o navegador bloqueia o carregamento do vídeo em arquivos locais. Para ver o vídeo andando com o scroll, rode um servidor simples dentro da pasta `site`:

```
npx http-server site -p 8080
```

e abra `http://localhost:8080` no Chrome, Safari ou Edge.

## Ver no celular

Abrir o arquivo direto no celular (pelo gerenciador de arquivos ou pelo zip) também mostra só a imagem parada, pelo mesmo motivo. Para ver o vídeo andando com o dedo, o site precisa estar num endereço `http`:

- Com o computador e o celular na mesma rede Wi-Fi, rode `npx http-server site -p 8080` no computador e abra no celular `http://IP-DO-COMPUTADOR:8080` (o `http-server` mostra esse endereço ao iniciar).
- Ou publique a pasta `site` (GitHub Pages, HostGator ou qualquer hospedagem).

## Trocar o destino do formulário

No começo de `site/assets/main.js`:

```js
const CONTATO = {
  whatsapp: '',              // ex.: '5511999999999' (DDI + DDD + número, só dígitos)
  instagram: 'winner_capital'
};
```

Com o número preenchido, o formulário abre o WhatsApp da empresa com a mensagem do visitante pronta. Vazio, ele copia a mensagem e leva ao Direct do Instagram.

## Antes de publicar

Em `site/index.html`, procure o comentário `DEPLOY STEP` e troque `https://SEU-DOMINIO/` pelo endereço real do site nas tags `og:url` e `og:image` (é o que faz a prévia do link aparecer bonita no WhatsApp e nas redes).

## Quem vê o quê

- Notebooks e desktops: o vídeo controlado pelo scroll.
- Celulares e tablets em pé: o mesmo vídeo de scroll, numa versão recortada no centro (`hero-scrub-retrato.mp4`, 2,5 MB), com o texto acima ou abaixo da bola. Se o tablet girar, o site troca de versão sozinho e mantém o ponto da jornada.
- Celular deitado e quem pede menos movimento no sistema: uma capa parada com o quadro final, desenhada para isso. Esses aparelhos não baixam o vídeo.
