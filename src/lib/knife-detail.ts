import type { Catalog, Piece } from "../../shared/types";

const catalogUrl = import.meta.env.PUBLIC_CATALOG_URL || "/catalog.json";
const mediaBaseUrl = import.meta.env.PUBLIC_MEDIA_BASE_URL || "";
const email = "stan@sbuzekknives.com";

function mediaUrl(path: string): string {
	return new URL(path, mediaBaseUrl.endsWith("/") ? mediaBaseUrl : `${mediaBaseUrl}/`).toString();
}

function showMessage(container: HTMLElement, message: string): void {
	const paragraph = document.createElement("p");
	paragraph.className = "catalog-message";
	paragraph.textContent = message;
	container.replaceChildren(paragraph);
	container.setAttribute("aria-busy", "false");
}

function renderPiece(container: HTMLElement, piece: Piece): void {
	const gallery = document.createElement("div");
	gallery.className = "detail-photos";
	for (const [index, photo] of piece.photos.entries()) {
		const image = document.createElement("img");
		image.src = mediaUrl(photo.display);
		image.alt = photo.alt || `${piece.title} - photo ${index + 1}`;
		image.width = photo.width;
		image.height = photo.height;
		image.loading = index === 0 ? "eager" : "lazy";
		gallery.append(image);
	}

	const details = document.createElement("div");
	details.className = "detail-copy";
	const eyebrow = document.createElement("p");
	eyebrow.className = "eyebrow";
	eyebrow.textContent = piece.status === "available" ? "Available" : "From the collection";
	const heading = document.createElement("h1");
	heading.textContent = piece.title;
	const description = document.createElement("p");
	description.className = "piece-description";
	description.textContent = piece.description;
	const inquire = document.createElement("a");
	inquire.className = "button-link";
	inquire.href = `mailto:${email}?subject=${encodeURIComponent(`Question about ${piece.title}`)}`;
	inquire.textContent = "Inquire about this knife";
	details.append(eyebrow, heading, description, inquire);
	container.replaceChildren(gallery, details);
	container.setAttribute("aria-busy", "false");
}

async function loadPiece(): Promise<void> {
	const container = document.querySelector<HTMLElement>("[data-knife-detail]");
	if (!container) return;
	const slug = decodeURIComponent(window.location.pathname.split("/").filter(Boolean).at(-1) || "");
	try {
		const response = await fetch(catalogUrl);
		if (!response.ok) throw new Error("Catalog unavailable");
		const catalog = (await response.json()) as Catalog;
		const piece = catalog.pieces.find((item) => item.slug === slug && item.status !== "hidden");
		if (!piece) {
			showMessage(container, "That knife could not be found. Browse the gallery to see the collection.");
			return;
		}
		renderPiece(container, piece);
	} catch {
		showMessage(container, "Knife details could not be loaded. Please try again shortly.");
	}
}

void loadPiece();