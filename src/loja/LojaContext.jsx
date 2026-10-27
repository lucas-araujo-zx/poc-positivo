import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  applyToolFilters,
  blankFilters,
  contextText,
  describeFilters,
  listPayload,
  targetCategory,
} from "./catalog";
import { AGENT_ID, sendContextualUpdate } from "./convai";

const LojaContext = createContext(null);

function asResult(payload) {
  return JSON.stringify(payload);
}

export function LojaProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [filtersByCategory, setFiltersByCategory] = useState({
    notebooks: blankFilters(),
    computadores: blankFilters(),
  });
  const locationRef = useRef(location);
  const filtersRef = useRef(filtersByCategory);
  locationRef.current = location;
  filtersRef.current = filtersByCategory;

  const actions = useMemo(() => {
    function remember(categoria, filters) {
      const next = { ...filtersRef.current, [categoria]: filters };
      filtersRef.current = next;
      setFiltersByCategory(next);
      return next;
    }

    return {
      navegar(args) {
        const destino = String(args?.destino ?? "").trim().toLowerCase();
        const path =
          destino === "notebooks"
            ? "/categoria/notebooks"
            : destino === "computadores"
              ? "/categoria/computadores"
              : destino === "inicio"
                ? "/"
                : null;
        if (!path) {
          return asResult({
            erro: "destino inválido. Use inicio, notebooks ou computadores.",
          });
        }
        navigate(path);
        if (destino === "inicio") {
          return asResult({ pagina: "inicio", total: 0, produtos: [] });
        }
        const filters = filtersRef.current[destino] ?? blankFilters();
        return asResult(listPayload(destino, filters));
      },

      filtrar_catalogo(args) {
        const pathname = locationRef.current.pathname;
        const categoria =
          pathname.startsWith("/categoria/notebooks")
            ? "notebooks"
            : pathname.startsWith("/categoria/computadores")
              ? "computadores"
              : null;
        const destino = categoria ?? targetCategory(pathname, args);
        const current = filtersRef.current[destino] ?? blankFilters();
        const { filters, avisos } = applyToolFilters(current, args ?? {});
        remember(destino, filters);
        navigate(`/categoria/${destino}`);
        return asResult({ ...listPayload(destino, filters), avisos });
      },

      abrir_pagina_produto(args) {
        const url = String(args?.url ?? "").trim();
        let parsed;
        try {
          parsed = new URL(url);
        } catch {
          return asResult({ erro: "url inválida" });
        }
        const host = parsed.hostname.toLowerCase();
        if (parsed.protocol !== "https:" || !host.endsWith("positivoempresas.com.br")) {
          return asResult({ erro: "url fora da loja Positivo Empresas" });
        }
        const opened = window.open(url, "_blank");
        if (opened) {
          opened.opener = null;
          return asResult({ aberto: true, url });
        }
        let link = document.getElementById("positivo-abrir-oficial");
        if (!link) {
          link = document.createElement("a");
          link.id = "positivo-abrir-oficial";
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Abrir página oficial";
          link.style.position = "fixed";
          link.style.right = "24px";
          link.style.bottom = "96px";
          link.style.zIndex = "2147483646";
          link.style.background = "#1e4f91";
          link.style.color = "#fff";
          link.style.padding = "14px 18px";
          link.style.borderRadius = "999px";
          link.style.font = "600 14px/1 sans-serif";
          link.style.textDecoration = "none";
          document.body.appendChild(link);
        }
        link.href = url;
        return asResult({
          aberto: false,
          url,
          erro: "o navegador bloqueou a nova guia",
          botao: "Abrir página oficial",
        });
      },

      ler_pagina() {
        const pathname = locationRef.current.pathname;
        if (pathname.startsWith("/produto/")) {
          return asResult({
            pagina: "produto",
            aviso: "A ficha desta tela não é fonte de preço, SKU nem especificação.",
          });
        }
        if (pathname.startsWith("/categoria/")) {
          const categoria = pathname.includes("computadores") ? "computadores" : "notebooks";
          const filters = filtersRef.current[categoria] ?? blankFilters();
          return asResult(listPayload(categoria, filters));
        }
        return asResult({ pagina: "inicio", filtros: "nenhum", total: 0, produtos: [] });
      },
    };
  }, [navigate]);

  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    const text = contextText(location.pathname, filtersByCategory);
    sendContextualUpdate(text);
  }, [location.pathname, filtersByCategory]);

  useEffect(() => {
    let widget = document.querySelector("elevenlabs-convai[data-positivo-loja]");
    if (!widget) {
      widget = document.createElement("elevenlabs-convai");
      widget.setAttribute("data-positivo-loja", "true");
      widget.setAttribute("agent-id", AGENT_ID);
      widget.setAttribute("variant", "full");
      document.body.appendChild(widget);
    }

    const onCall = (event) => {
      const config = event.detail?.config;
      if (!config) return;
      const pathname = locationRef.current.pathname;
      const categoria = pathname.includes("computadores")
        ? "computadores"
        : pathname.includes("notebooks")
          ? "notebooks"
          : null;
      const filters = categoria ? filtersRef.current[categoria] : blankFilters();
      config.dynamicVariables = {
        pagina_atual: contextText(pathname, filtersRef.current),
        filtros_ativos: describeFilters(filters),
      };
      config.clientTools = {
        navegar: (params) => actionsRef.current.navegar(params),
        filtrar_catalogo: (params) => actionsRef.current.filtrar_catalogo(params),
        abrir_pagina_produto: (params) => actionsRef.current.abrir_pagina_produto(params),
        ler_pagina: () => actionsRef.current.ler_pagina(),
      };
    };

    widget.addEventListener("elevenlabs-convai:call", onCall);
    return () => {
      widget.removeEventListener("elevenlabs-convai:call", onCall);
      widget.remove();
    };
  }, []);

  const value = useMemo(
    () => ({
      filtersByCategory,
      setCategoryFilters(categoria, updater) {
        setFiltersByCategory((current) => {
          const nextFilters = updater(current[categoria] ?? blankFilters());
          const next = { ...current, [categoria]: nextFilters };
          filtersRef.current = next;
          return next;
        });
      },
    }),
    [filtersByCategory],
  );

  return <LojaContext.Provider value={value}>{children}</LojaContext.Provider>;
}

export function useLoja() {
  const value = useContext(LojaContext);
  if (!value) throw new Error("useLoja fora do LojaProvider");
  return value;
}
