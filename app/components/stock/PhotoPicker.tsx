import { useEffect, useMemo, useRef, useState } from "react";
import { PHOTO_MAX_SIDE, PHOTO_QUALITY, PHOTO_UNREADABLE } from "../../lib/stock/photo";

/**
 * Choisir la photo d'un vin : sur un téléphone, l'appareil photo ou la galerie ; sur un ordinateur,
 * un fichier. La photo est réduite dans le navigateur avant l'envoi, puis montrée en aperçu.
 */

/** Réduit la photo (côté le plus long : 1600 px) et la convertit en JPEG ; `null` si illisible. */
async function shrinkPhoto(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (context === null) return null;
    // Fond blanc : une photo PNG détourée ne devient pas noire en JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY));
    return blob === null ? null : new File([blob], "photo.jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}

interface PhotoPickerProps {
  readonly photo: File | null;
  readonly onChange: (photo: File | null) => void;
  /** Photo actuelle du vin, montrée tant qu'aucune nouvelle n'est choisie. */
  readonly currentUrl?: string | null;
  readonly disabled?: boolean;
}

export function PhotoPicker({ photo, onChange, currentUrl = null, disabled = false }: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const preview = useMemo(() => (photo === null ? null : URL.createObjectURL(photo)), [photo]);
  useEffect(() => () => (preview === null ? undefined : URL.revokeObjectURL(preview)), [preview]);
  const shown = preview ?? currentUrl;

  const choose = async (file: File | undefined) => {
    if (file === undefined) return;
    setReading(true);
    setProblem(null);
    const shrunk = await shrinkPhoto(file);
    setReading(false);
    if (shrunk === null) setProblem(PHOTO_UNREADABLE);
    else onChange(shrunk);
  };

  return (
    <s-stack direction="block" gap="small-200">
      <s-text type="strong">Photo du vin</s-text>
      <s-stack direction="inline" gap="small-200" alignItems="center">
        {shown === null ? <s-thumbnail alt="" size="base" /> : <s-thumbnail src={shown} alt="Aperçu de la photo" size="base" />}
        <s-button icon="image" onClick={() => input.current?.click()} {...(reading ? { loading: true } : {})} {...(disabled ? { disabled: true } : {})}>
          {shown === null ? "Choisir une photo" : "Choisir une autre photo"}
        </s-button>
        {photo === null ? null : (
          <s-button variant="tertiary" tone="critical" onClick={() => onChange(null)} {...(disabled ? { disabled: true } : {})}>
            Enlever
          </s-button>
        )}
      </s-stack>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void choose(file);
        }}
      />
      {problem === null ? null : <s-text tone="critical">{problem}</s-text>}
    </s-stack>
  );
}
