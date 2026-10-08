import { Link, Route, Routes, useParams } from "react-router-dom";
import { HomePage } from "./HomePage";
import { LojaProvider, useLoja } from "./LojaContext";
import {
  CATEGORIES,
  GROUPS,
  blankFilters,
  describeFilters,
  facetOptions,
  formatBrl,
  productBySlug,
  visibleProducts,
} from "./catalog";

export function StoreApp() {
  return (
    <LojaProvider>
      <div className="shop">
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/categoria/:categoria" element={<main className="page"><CategoryPage /></main>} />
          <Route path="/produto/:slug" element={<main className="page"><ProductPage /></main>} />
        </Routes>
      </div>
    </LojaProvider>
  );
}

function Header() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="logo" aria-label="Página inicial">
          <img src="https://static.meupositivo.com.br/images/b2b/logo-positivo-empresas.png" alt="Positivo Empresas" />
        </Link>
        <nav className="site-nav">
          <div className="menu">
            <span>Produtos</span>
            <div className="menu-panel">
              <Link to="/categoria/notebooks">Notebooks</Link>
              <Link to="/categoria/computadores">Computadores</Link>
            </div>
          </div>
          <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Soluções</a>
          <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Suporte</a>
          <a href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">Inteligência Artificial</a>
        </nav>
        <div className="site-tools">
          <a className="talk" href="https://loja.positivoempresas.com.br/" target="_blank" rel="noreferrer">
            <IconHeadset />
            Fale conosco
          </a>
          <Link to="/categoria/notebooks" aria-label="Buscar produtos"><IconSearch /></Link>
          <a href="https://loja.positivoempresas.com.br/cliente/cadastro" target="_blank" rel="noreferrer" aria-label="Login"><IconUser /></a>
          <Link to="/categoria/notebooks" aria-label="Carrinho"><IconBag /></Link>
        </div>
      </div>
    </header>
  );
}

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      {children}
    </svg>
  );
}

function IconHeadset() {
  return (
    <Icon>
      <path d="M4 13a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="13" width="4" height="6" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="17" y="13" width="4" height="6" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Icon>
  );
}

function IconSearch() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 16l4 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Icon>
  );
}

function IconUser() {
  return (
    <Icon>
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 19c1.4-3 3.8-4.5 7-4.5S17.6 16 19 19" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Icon>
  );
}

function IconBag() {
  return (
    <Icon>
      <path d="M6 8h12l-1 12H7L6 8z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Icon>
  );
}

function CategoryPage() {
  const { categoria } = useParams();
  const { filtersByCategory, setCategoryFilters } = useLoja();
  if (!CATEGORIES[categoria]) {
    return <p className="empty">Categoria não disponível nesta réplica.</p>;
  }
  const filters = filtersByCategory[categoria] ?? blankFilters();
  const products = visibleProducts(categoria, filters);

  function toggle(key, value) {
    setCategoryFilters(categoria, (current) => {
      const selected = current[key] ?? [];
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];
      return { ...current, [key]: next };
    });
  }

  return (
    <div className="catalog">
      <aside>
        <div className="filters">
          <div className="filters-head">
            <h2>Filtros</h2>
            <button type="button" onClick={() => setCategoryFilters(categoria, () => blankFilters())}>
              Limpar
            </button>
          </div>
          {GROUPS.map(([key, label]) => {
            const options = facetOptions(categoria, key);
            if (options.length === 0) return null;
            return (
              <fieldset key={key}>
                <legend>{label}</legend>
                {options.map((option) => (
                  <label key={option}>
                    <input
                      type="checkbox"
                      checked={(filters[key] ?? []).includes(option)}
                      onChange={() => toggle(key, option)}
                    />
                    {option}
                  </label>
                ))}
              </fieldset>
            );
          })}
          {filters.precoMax != null ? (
            <p className="price-cap">Até {formatBrl(filters.precoMax)}</p>
          ) : null}
        </div>
      </aside>
      <section>
        <div className="list-head">
          <div>
            <h1>{CATEGORIES[categoria]}</h1>
            <p>
              Foram encontrados {products.length} resultados.
              {describeFilters(filters) !== "nenhum" ? ` ${describeFilters(filters)}.` : ""}
            </p>
          </div>
        </div>
        <ul className="cards">
          {products.map((product) => (
            <li key={product.slug}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
        {products.length === 0 ? (
          <p className="empty">Nenhum equipamento com esses filtros.</p>
        ) : null}
      </section>
    </div>
  );
}

function ProductCard({ product }) {
  return (
    <article className="card">
      <ProductImage product={product} />
      <div>
        <h2>
          <Link to={`/produto/${product.slug}`}>{product.nome}</Link>
        </h2>
        <p>{product.resumo}</p>
        <p className="meta">
          {product.memoria} · {product.processador} · {product.armazenamento}
        </p>
        <p className="price">
          A partir de <strong>{formatBrl(product.precoPix)}</strong> no PIX
        </p>
        <p className="installments">Ou em até {product.parcelas} sem juros</p>
        <p className="note">O valor final pode variar conforme o CNPJ.</p>
        <Link className="buy" to={`/produto/${product.slug}`}>
          Selecionar e comprar
        </Link>
      </div>
    </article>
  );
}

function ProductPage() {
  const { slug } = useParams();
  const product = productBySlug(slug);
  if (!product) return <p className="empty">Produto não encontrado nesta réplica.</p>;

  return (
    <article className="product">
      <p className="crumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to={`/categoria/${product.categoria}`}>{CATEGORIES[product.categoria]}</Link>
      </p>
      <div className="product-layout">
        <ProductImage product={product} large />
        <div>
          <h1>{product.nomeCompleto}</h1>
          <p className="code">Código {product.codigo}</p>
          <p className="price">
            A partir de <strong>{formatBrl(product.precoPix)}</strong> no PIX
          </p>
          <p className="installments">Ou em até {product.parcelas} sem juros</p>
          <p className="note">O valor final pode variar conforme o CNPJ.</p>
        </div>
      </div>
      <h2>Especificações</h2>
      <dl className="specs">
        {product.especificacoes.map((item) => (
          <div key={item.chave}>
            <dt>{item.chave}</dt>
            <dd>{item.valor}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function ProductImage({ product, large = false }) {
  if (!product.imagem) {
    return <div className={large ? "photo photo-lg" : "photo"}>{product.nome}</div>;
  }
  return (
    <img
      className={large ? "photo photo-lg" : "photo"}
      src={product.imagem}
      alt={product.nome}
      onError={(event) => {
        event.currentTarget.replaceWith(Object.assign(document.createElement("div"), {
          className: large ? "photo photo-lg" : "photo",
          textContent: product.nome,
        }));
      }}
    />
  );
}
