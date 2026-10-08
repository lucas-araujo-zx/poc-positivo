import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const banner = (id, hash) =>
  `https://loja.positivoempresas.com.br/imagem/banner/id/${id}?h=${hash}`;

const HERO = [
  {
    src: banner(37, "c75eb81185f4a092ffebed6fbc1c0d34e9e15dc7"),
    alt: "Mais tecnologia para seu negócio",
    to: "/categoria/notebooks",
  },
  {
    src: banner(39, "8b0509d7835c087777ae3a6ba8c9e22b5761dcbd"),
    alt: "Tecnologia que impulsiona",
    href: "https://loja.positivoempresas.com.br/cliente/cadastro",
  },
  {
    src: banner(81, "31400113d9165db8598503f7eae60ccc3f96c8aa"),
    alt: "Copilot+PC",
    to: "/categoria/notebooks",
  },
  {
    src: banner(38, "fda9198771607a2e1da8c7755bcd8e23d1ada6dd"),
    alt: "Positivo Master",
    to: "/categoria/notebooks",
  },
];

const CATEGORY_TILES = [
  { alt: "Notebooks", src: banner(40, "fba46ee67186b55ce2ec9bcd87fa7aa22ba648f7"), to: "/categoria/notebooks" },
  { alt: "Desktops", src: banner(41, "f584f225ac35e0de538fc44a4f170e99d2583a15"), to: "/categoria/computadores" },
  { alt: "Mini desktops", src: banner(76, "fd09b2cc634de38c1fd0b07f86e70ef08b2337a1"), to: "/categoria/computadores" },
  { alt: "Tablets", src: banner(42, "1f439044045ca52035c057b88d3c581530566a03"), href: "https://loja.positivoempresas.com.br/categoria/tablets" },
  { alt: "All in one", src: banner(43, "cab91f9bc740c63efdfeb0416013497c03797ca5"), to: "/categoria/computadores" },
  { alt: "Monitor", src: banner(44, "d6ebd86d9b37469c34c2536b3db2b2b898a7c1b7"), href: "https://loja.positivoempresas.com.br/categoria/acessorios/monitores" },
];

const PRODUCTS = [
  {
    title: "Notebook FE16",
    text: "Combinação entre portabilidade e robustez para a sua empresa.",
    src: banner(45, "ec68a4b8958656766537d8e261b206797594af14"),
    to: "/produto/notebook-vaio-fe16-amdR-ryzen-5-5625u-linux-16gb-ram-512gb-ssd-16-ips-wuxga-cinza-grafite-202",
  },
  {
    title: "Notebook Master N8460",
    text: "Soluções completas de tecnologia para sua empresa.",
    src: banner(46, "1775d70575a6d9b74b1c98b197ed164a2f764658"),
    to: "/produto/notebook-positivo-master-n8460-copilot-pc-intel-core-ultra-5-325-windows-11-home-16gb-ram-512gb-ssd-14-full-hd-cinza-318",
  },
  {
    title: "All in One Master",
    text: "Tudo em um. Menos fios. Mais produtividade.",
    src: banner(47, "cebc4788a553cd75da316b70127f091857606206"),
    to: "/produto/positivo-master-a6400-intel-core-i5-1334u-windows-11-home-16gb-ram-512gb-ssd-23-8-full-hd-ips-cinza-348",
  },
  {
    title: "Tablet TL12",
    text: "Mobilidade e performance. Mais produtividade para os profissionais.",
    src: banner(48, "954b32a8b66d620c037faf5df52679261e641caf"),
    href: "https://loja.positivoempresas.com.br/categoria/tablets",
  },
  {
    title: "Notebook F14",
    text: "Acabamento único. Performance para grandes desafios.",
    src: banner(49, "645e1d3f497617cb3b852df8f4291c1e339f50cd"),
    href: "https://loja.positivoempresas.com.br/categoria/notebooks",
  },
  {
    title: "Tablet Vision TAB 7",
    text: "Tablet compacto, ideal para quem precisa de mobilidade e eficiência.",
    src: banner(50, "23c8394366dd5b28127fdbd6e9f5dc8e8a15d5c5"),
    href: "https://loja.positivoempresas.com.br/categoria/tablets",
  },
];

const FAVORITES = [
  {
    kicker: "Notebooks VAIO F14",
    title: "Inove com praticidade com o Copilot",
    text: "Confie no uso de IA - use o atalho Copilot para maior praticidade e eficiência no contato com IA.",
    src: banner(52, "9b0de2f4beed7e9d58b8e9e4c929ca72c2403a45"),
    href: "https://loja.positivoempresas.com.br/categoria/notebooks",
  },
  {
    kicker: "Notebooks VAIO FE16",
    title: "Desempenho que ultrapassa barreiras",
    text: "Turbine a produtividade com processadores avançados e gráficos profissionais de última geração.",
    src: banner(51, "c104c0142424415a196e63c66c1f1c6ab92d0f60"),
    to: "/categoria/notebooks",
  },
  {
    kicker: "Notebooks Positivo Master",
    title: "Robustez e durabilidade para seu trabalho",
    text: "Notebook corporativo que combina resistência e potência, para trabalhar com eficiência em qualquer lugar.",
    src: banner(53, "9539b2cbb1f5fe0bf98fc4b480f65764527da029"),
    to: "/categoria/notebooks",
  },
];

const ARTICLES = [
  {
    title: "Tendências TI",
    text: "Você costuma usar Inteligência Artificial (IA) no seu dia a dia? Os setores mais expostos à IA registram um aumento de produtividade no trabalho de 4,8 vezes, segundo relatório da PwC.",
  },
  {
    title: "Tecnologia que move negócios",
    text: "A eficiência operacional consiste em otimizar processos e recursos comerciais, ao mesmo tempo em que reduz custos operacionais.",
  },
  {
    title: "Como abrir uma empresa",
    text: "No Brasil há um total de 22,4 milhões de empresas ativas. Em janeiro de 2025 foram abertos 573 mil novos CNPJs.",
  },
  {
    title: "Dicas para novos negócios",
    text: "Há três modelos disponíveis: Simples Nacional, Lucro Presumido e Lucro Real. A primeira opção, normalmente, é indicada para quem está começando.",
  },
  {
    title: "15 ideias de negócios lucrativos para 2025",
    text: "O empreendedorismo tem o poder de melhorar a vida das pessoas, estimular a inovação e impactar o desenvolvimento econômico do país.",
  },
];

function ShopLink({ to, href, className, children }) {
  if (to) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function Hero() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((current) => (current + 1) % HERO.length), 7000);
    return () => clearInterval(timer);
  }, []);
  const slide = HERO[index];

  return (
    <section className="hero" aria-label="Destaques">
      <ShopLink to={slide.to} href={slide.href} className="hero-slide">
        <img src={slide.src} alt={slide.alt} />
      </ShopLink>
      <button type="button" className="hero-arrow hero-prev" aria-label="Banner anterior" onClick={() => setIndex((current) => (current - 1 + HERO.length) % HERO.length)}>
        ‹
      </button>
      <button type="button" className="hero-arrow hero-next" aria-label="Próximo banner" onClick={() => setIndex((current) => (current + 1) % HERO.length)}>
        ›
      </button>
      <div className="hero-dots">
        {HERO.map((item, dot) => (
          <button
            key={item.alt}
            type="button"
            aria-label={`Ir para o banner ${dot + 1}`}
            className={dot === index ? "is-on" : ""}
            onClick={() => setIndex(dot)}
          />
        ))}
      </div>
    </section>
  );
}

function Rail({ label, children }) {
  return (
    <div className="rail-wrap">
      <div className="rail" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function HomePage() {
  const [favorite, setFavorite] = useState(0);
  const currentFavorite = FAVORITES[favorite];

  return (
    <div className="home">
      <Hero />

      <section className="band">
        <h2>Mais tecnologia para sua empresa</h2>
        <Rail label="Categorias">
          {CATEGORY_TILES.map((tile) => (
            <ShopLink key={tile.alt} to={tile.to} href={tile.href} className="tile">
              <img src={tile.src} alt={tile.alt} />
            </ShopLink>
          ))}
        </Rail>
      </section>

      <section className="band">
        <h2>Conheça nossos produtos</h2>
        <Rail label="Produtos">
          {PRODUCTS.map((product) => (
            <ShopLink key={product.title} to={product.to} href={product.href} className="spotlight">
              <strong>{product.title}</strong>
              <span>{product.text}</span>
              <img src={product.src} alt="" />
            </ShopLink>
          ))}
        </Rail>
      </section>

      <section className="band">
        <h2>Escolha o seu canal de atendimento</h2>
        <div className="channels">
          <article>
            <h3>Compre pelo WhatsApp</h3>
            <p>Fale com um especialista para encontrarmos as especificações ideias.</p>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Saiba mais →</a>
          </article>
          <article>
            <h3>Precisa de ajuda?</h3>
            <p>Entre em contato com o nosso time, e envie sua solicitação por e-mail.</p>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Saiba mais →</a>
          </article>
          <article>
            <h3>Login</h3>
            <p>Faça login para acessar sua conta e acompanhar o status dos seus pedidos.</p>
            <a href="https://loja.positivoempresas.com.br/cliente/cadastro" target="_blank" rel="noreferrer">Saiba mais →</a>
          </article>
        </div>
      </section>

      <section className="band">
        <div className="band-head">
          <h2>Favoritos para impulsionar resultados</h2>
          <div className="pager">
            <button type="button" aria-label="Favorito anterior" onClick={() => setFavorite((current) => (current - 1 + FAVORITES.length) % FAVORITES.length)}>‹</button>
            <button type="button" aria-label="Próximo favorito" onClick={() => setFavorite((current) => (current + 1) % FAVORITES.length)}>›</button>
          </div>
        </div>
        <div className="favorites">
          <article>
            <div>
              <p>{currentFavorite.kicker}</p>
              <h3>{currentFavorite.title}</h3>
              <span>{currentFavorite.text}</span>
              <ShopLink to={currentFavorite.to} href={currentFavorite.href} className="more">Saiba mais →</ShopLink>
            </div>
            <img src={currentFavorite.src} alt="" />
          </article>
        </div>
      </section>

      <section className="specialists">
        <h2>Fale com nossa equipe de especialistas</h2>
        <p>Oferecemos desde suporte especializado até soluções completas para todas as necessidades do negócio.</p>
        <a className="cta" href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Entre em contato →</a>
        <div className="help-row">
          <article>
            <h3>Compre pelo Whatsapp</h3>
            <p>Entre em contato para encontrar o produto ideal para sua empresa.</p>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Saiba mais →</a>
          </article>
          <article>
            <h3>Suporte técnico</h3>
            <p>Envie sua solicitação de atendimento por e-mail ou ligue 0800-644-7500.</p>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Saiba mais →</a>
          </article>
          <article>
            <h3>Suporte a pedidos</h3>
            <p>Já é cliente? Fale com nosso time de suporte de vendas por e-mail.</p>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Saiba mais →</a>
          </article>
        </div>
      </section>

      <section className="band know">
        <h2>Tudo o que sua empresa precisa saber</h2>
        <p className="know-lead">
          De microempreendedores individuais e pequenas empresas a grandes corporações, organizações de sucesso em todos os setores crescem com a Positivo.
        </p>
        <Rail label="Conteúdos">
          {ARTICLES.map((article) => (
            <a key={article.title} className="article" href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">
              <strong>{article.title}</strong>
              <span>{article.text}</span>
              <em>Saiba mais →</em>
            </a>
          ))}
        </Rail>
        <ShopLink href="https://loja.positivoempresas.com.br/" className="solutions">
          <img src={banner(58, "32f5fe539574b0e80927aa78317f1e57caf0a7ee")} alt="Soluções inteligentes para seu negócio" />
        </ShopLink>
      </section>

      <section className="newsletter">
        <h2>Quer receber novidades sobre a Positivo Empresas?</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <label>
            Nome*
            <input name="nome" placeholder="Seu nome" autoComplete="name" />
          </label>
          <label>
            E-mail*
            <input name="email" type="email" placeholder="Seu e-mail" autoComplete="email" />
          </label>
          <label>
            Número de Celular*
            <input name="celular" placeholder="+55" autoComplete="tel" />
          </label>
          <button type="submit">Receber Novidades</button>
        </form>
        <p>
          Utilizamos seus dados com a finalidade de orientar sobre produtos e demais informações pertinentes. Para maiores informações sobre a utilização dos seus dados consulte nossa Política de Privacidade e Cookies.
        </p>
      </section>

      <footer className="site-footer">
        <div className="footer-brand">
          <img src="https://static.meupositivo.com.br/images/b2b/logo-positivo-empresas.png" alt="Positivo Empresas" />
          <div>
            <h3>PAGUE COM</h3>
            <div className="pays">
              <img src="https://loja.positivoempresas.com.br/imagem/pagamento/height/0/width/0/driver/cartao_visa" alt="Visa" />
              <img src="https://loja.positivoempresas.com.br/imagem/pagamento/height/0/width/0/driver/cartao_master" alt="Mastercard" />
              <img src="https://loja.positivoempresas.com.br/imagem/pagamento/height/0/width/0/driver/cartao_amex" alt="American Express" />
              <img src="https://loja.positivoempresas.com.br/imagem/pagamento/height/0/width/0/driver/cartao_elo" alt="Elo" />
              <img src="https://loja.positivoempresas.com.br/imagem/pagamento/height/0/width/0/driver/pix" alt="Pix" />
              <img src="https://loja.positivoempresas.com.br/imagem/pagamento/height/0/width/0/driver/bankbill" alt="Boleto" />
            </div>
          </div>
        </div>
        <div className="footer-cols">
          <div>
            <h3>INSTITUCIONAL</h3>
            <a href="https://www.positivotecnologia.com.br/" target="_blank" rel="noreferrer">A Positivo</a>
            <a href="https://www.positivotecnologia.com.br/" target="_blank" rel="noreferrer">Positivo Tecnologia</a>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Imprensa</a>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Investidores</a>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Resp. Social</a>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Resp. Ambiental</a>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Copilot Plus PC</a>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Conteúdos</a>
          </div>
          <div>
            <h3>DÚVIDAS</h3>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Trabalhe Conosco</a>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Termos de uso</a>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Política de privacidade</a>
            <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Política de Garantia</a>
          </div>
          <div>
            <h3>MINHA CONTA</h3>
            <a href="https://loja.positivoempresas.com.br/cliente/cadastro" target="_blank" rel="noreferrer">Meu Cadastro</a>
            <a href="https://loja.positivoempresas.com.br/cliente/cadastro" target="_blank" rel="noreferrer">Meus Pedidos</a>
          </div>
        </div>
        <div className="seals">
          <h3>SITE SEGURO</h3>
          <img src="https://loja.positivoempresas.com.br/imagem/render-image/height/0/width/0/manager/footer-seals/reference/1" alt="Compra segura" />
          <img src="https://loja.positivoempresas.com.br/imagem/render-image/height/0/width/0/manager/footer-seals/reference/2" alt="Cloudflare" />
        </div>
        <p className="legal">2026 © Todos os Direitos Reservados | Positivo Empresas | CNPJ: 81.243.735/0001-48</p>
      </footer>
    </div>
  );
}
