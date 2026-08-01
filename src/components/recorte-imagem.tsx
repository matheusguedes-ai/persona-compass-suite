/**
 * Recorte de imagem antes do envio — capa de material, capa de pasta e
 * banner da Academy.
 *
 * O `object-cover` do CSS já escondia o problema (a tela sempre mostrou algo
 * arrumado), mas quem escolhia o corte era o navegador — pegando sempre o
 * centro da imagem, o que corta rosto e texto em fotos verticais ou em
 * banners largos. Aqui quem escolhe o enquadramento é a pessoa, antes de
 * subir. Escala o resultado para no máximo `ladoMaior` px e sempre exporta
 * JPEG — os três pontos que usam isto já restringem a um input JPG/PNG, e
 * padronizar evita depender do encoder de WEBP/HEIC do navegador.
 */
import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn } from "lucide-react";

async function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function recortar(src: string, area: Area, ladoMaior: number, nomeSaida: string): Promise<File> {
  const imagem = await carregarImagem(src);
  const escala = Math.min(1, ladoMaior / Math.max(area.width, area.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width * escala);
  canvas.height = Math.round(area.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não consegui preparar o recorte.");
  ctx.drawImage(
    imagem,
    area.x, area.y, area.width, area.height,
    0, 0, canvas.width, canvas.height,
  );
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Não consegui gerar o recorte.");
  return new File([blob], nomeSaida, { type: "image/jpeg" });
}

export function RecortarImagem({
  arquivo, aspecto, ladoMaior = 1600, limiteEntradaMb = 20, onConcluir, onCancelar,
}: {
  /** `null` mantém o diálogo fechado. */
  arquivo: File | null;
  /** Largura ÷ altura do recorte final — ex.: 16/9. */
  aspecto: number;
  /** Maior lado do arquivo exportado, em pixels. */
  ladoMaior?: number;
  /**
   * Tamanho máximo do ARQUIVO ORIGINAL antes do recorte, em MB. Generoso de
   * propósito: o limite de saída (3 MB, checado por quem chama) já garante um
   * upload leve — isto aqui só evita jogar uma foto de 40 MP direto num
   * `<canvas>` no celular da pessoa antes mesmo de ela poder recortar.
   */
  limiteEntradaMb?: number;
  onConcluir: (recortado: File) => void;
  onCancelar: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [processando, setProcessando] = useState(false);

  const grandeDemais = !!arquivo && arquivo.size > limiteEntradaMb * 1024 * 1024;
  const src = arquivo && !grandeDemais ? URL.createObjectURL(arquivo) : null;

  const aoCompletarRecorte = useCallback((_: Area, areaEmPixels: Area) => {
    setArea(areaEmPixels);
  }, []);

  const fechar = (v: boolean) => { if (!v) onCancelar(); };

  async function confirmar() {
    if (!src || !area || !arquivo) return;
    setProcessando(true);
    try {
      const nome = arquivo.name.replace(/\.[^.]+$/, "") + ".jpg";
      const recortado = await recortar(src, area, ladoMaior, nome);
      onConcluir(recortado);
    } catch (e) {
      // Sem toast aqui de propósito — quem chama decide como avisar,
      // e este componente não sabe em qual bucket vai cair o arquivo.
      console.error(e);
    } finally {
      setProcessando(false);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setArea(null);
    }
  }

  return (
    <Dialog open={!!arquivo} onOpenChange={fechar}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustar o recorte</DialogTitle>
          <DialogDescription>Arraste para posicionar e use o controle para aproximar.</DialogDescription>
        </DialogHeader>

        {grandeDemais ? (
          <p className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            Este arquivo passa de {limiteEntradaMb} MB. Escolha uma imagem menor para recortar.
          </p>
        ) : (
          <>
            {src && (
              <div className="relative h-72 w-full overflow-hidden rounded-lg bg-black/90">
                <Cropper
                  image={src}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspecto}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={aoCompletarRecorte}
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
              <Slider
                value={[zoom]} min={1} max={3} step={0.01}
                onValueChange={([v]) => setZoom(v)}
              />
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancelar} disabled={processando}>Cancelar</Button>
          {!grandeDemais && (
            <Button onClick={confirmar} disabled={!area || processando}>
              {processando ? "Recortando…" : "Usar este recorte"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
