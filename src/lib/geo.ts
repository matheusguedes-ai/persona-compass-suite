/**
 * Distância entre duas coordenadas. Sem nada de servidor dentro: a tela do
 * professor precisa da mesma conta para dizer "você está a 40 m do ponto
 * travado" antes de gravar.
 */

export type Coordenada = { lat: number; lng: number };

const RAIO_DA_TERRA_M = 6_371_000;

const rad = (g: number) => (g * Math.PI) / 180;

/**
 * Haversine. Erro menor que 0,5% em qualquer distância — e aqui se compara
 * dezenas de metros contra centenas, então a esfera basta e a fórmula cabe em
 * seis linhas legíveis.
 */
export function distanciaEmMetros(a: Coordenada, b: Coordenada): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * RAIO_DA_TERRA_M * Math.asin(Math.min(1, Math.sqrt(h))));
}

/**
 * A folga que a imprecisão do próprio aparelho compra.
 *
 * O navegador devolve `accuracy` em metros junto da coordenada, e ignorá-la
 * reprovaria quem está na sala com sinal ruim. Mas ela vem do cliente: um
 * aparelho pode alegar "precisão: 50 km" e a trava viraria enfeite. Daí o teto
 * — 250 m absorve o GPS ruim de verdade e não absorve a cidade inteira.
 */
export const FOLGA_MAXIMA_M = 250;

export function folgaDaPrecisao(precisao: number | null | undefined): number {
  if (!precisao || !Number.isFinite(precisao) || precisao < 0) return 0;
  return Math.min(precisao, FOLGA_MAXIMA_M);
}

/** Para a tela: "120 m" ou "12,4 km". */
export function distanciaLegivel(metros: number): string {
  if (metros < 1000) return `${metros} m`;
  return `${(metros / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

/**
 * Pede a posição ao navegador. Devolve `null` em vez de estourar: a tela do
 * aluno precisa distinguir "recusou/não pegou" de "pegou e está longe", e as
 * duas mensagens são diferentes.
 *
 * `enableHighAccuracy` liga o GPS de verdade (o padrão é a triangulação por
 * wifi, que erra quarteirões). 15 s de teto porque o aluno está em pé na porta.
 */
export function posicaoAtual(): Promise<GeolocationPosition | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}
