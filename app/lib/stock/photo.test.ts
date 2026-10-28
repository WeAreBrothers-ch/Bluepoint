import { describe, expect, it } from "vitest";
import { formPhoto, MAX_PHOTO_BYTES, photoFilename, photoProblem } from "./photo";

describe("photo d'un vin", () => {
  it("accepte une photo JPEG, PNG ou WebP de taille raisonnable", () => {
    expect(photoProblem({ type: "image/jpeg", size: 300_000 })).toBeNull();
    expect(photoProblem({ type: "image/webp", size: 1 })).toBeNull();
    expect(photoProblem({ type: "application/pdf", size: 300_000 })).toContain("pas une photo");
    expect(photoProblem({ type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 })).toContain("trop lourde");
    expect(photoProblem({ type: "image/png", size: 0 })).toContain("vide");
  });

  it("nomme le fichier d'après le vin", () => {
    expect(photoFilename("Dézaley Marsens — Grand Cru 2025", "image/jpeg")).toBe("dezaley-marsens-grand-cru-2025.jpg");
    expect(photoFilename("  ***  ", "image/png")).toBe("vin.png");
  });

  it("ne garde qu'une vraie photo envoyée par le formulaire", () => {
    const form = new FormData();
    expect(formPhoto(form)).toBeNull();
    form.set("photo", new File([], "vide.jpg", { type: "image/jpeg" }));
    expect(formPhoto(form)).toBeNull();
    form.set("photo", new File(["abc"], "photo.jpg", { type: "image/jpeg" }));
    expect(formPhoto(form)?.size).toBe(3);
  });
});
