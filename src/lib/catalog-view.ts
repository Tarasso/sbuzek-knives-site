import type { Catalog, Piece } from "../../shared/types";

const catalogUrl = import.meta.env.PUBLIC_CATALOG_URL || "/catalog.json";
const mediaBaseUrl = import.meta.env.PUBLIC_MEDIA_BASE_URL || "";

function mediaUrl(path: string): string {
	return new URL(path, mediaBaseUrl.endsWith("/") ? mediaBaseUrl : `${mediaBaseUrl}/`).toString();
}

function makePieceCard(piece: Piece): HTMLElement {
	const article = document.createElement("article");
	article.className = "piece-card";
	const link = document.createElement("a");
	link.className = "piece-image-link";
	link.href = `/knife/${encodeURIComponent(piece.slug)}`;
	link.setAttribute("aria-label", `View ${piece.title}`);

	const photo = piece.photos[0];
	if (photo) {
		const image = document.createElement("img");
		image.className = "piece-image";
		image.src = mediaUrl(photo.thumb);
		image.alt = photo.alt || `${piece.title} - photo 1`;
		image.width = photo.width;
		image.height = photo.height;
		image.loading = "lazy";
		link.append(image);
	} else {
		const placeholder = document.createElement("span");
		placeholder.className = "piece-image-placeholder";
		placeholder.textContent = "S. Buzek Knives";
		link.append(placeholder);
	}

	const caption = document.createElement("div");
	caption.className = "piece-caption";
	const title = document.createElement("h3");
	const titleLink = document.createElement("a");
	titleLink.href = link.href;
	titleLink.textContent = piece.title;
	title.append(titleLink);
	caption.append(title);
	if (piece.status === "available") {
		const note = document.createElement("p");
		note.className = "price-note";
		note.textContent = piece.priceNote || "Available - email to inquire";
		caption.append(note);
	}
	article.append(link, caption);
	return article;
}

function selectPieces(catalog: Catalog, mode: string): Piece[] {
	const ordered = [...catalog.pieces].sort((first, second) => first.sortOrder - second.sortOrder);
	if (mode === "available") return ordered.filter((piece) => piece.status === "available");
	if (mode === "featured") {
		const visible = ordered.filter((piece) => piece.status === "gallery" || piece.status === "available");
		const featured = visible.filter((piece) => piece.featured);
		return (featured.length ? featured : visible).slice(0, 6);
	}
	return ordered.filter((piece) => piece.status === "gallery" || piece.status === "available");
}

function renderMessage(container: HTMLElement, message: string, isError = false): void {
	const paragraph = document.createElement("p");
	paragraph.className = isError ? "catalog-message catalog-error" : "catalog-message";
	paragraph.textContent = message;
	container.replaceChildren(paragraph);
	container.setAttribute("aria-busy", "false");
}

async function loadCatalog(container: HTMLElement): Promise<void> {
	const mode = container.dataset.catalogView || "gallery";
	try {
		const response = await fetch(catalogUrl);
		if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
		const catalog = (await response.json()) as Catalog;
		const pieces = selectPieces(catalog, mode);
		if (!pieces.length) {
			if (mode === "available") {
				const message = document.createElement("p");
				message.className = "catalog-message";
				message.append("Nothing available right now. Please ");
				const emailLink = document.createElement("a");
				emailLink.href = "mailto:stan@sbuzekknives.com";
				emailLink.textContent = "email me about upcoming knives";
				message.append(emailLink, ".");
				container.replaceChildren(message);
				container.setAttribute("aria-busy", "false");
			} else {
				renderMessage(container, "Knives will be added to the gallery soon.");
			}
			return;
		}
		const grid = document.createElement("div");
		grid.className = "piece-grid";
		for (const piece of pieces) grid.append(makePieceCard(piece));
		container.replaceChildren(grid);
		container.setAttribute("aria-busy", "false");
	} catch {
		renderMessage(container, "The knife collection could not be loaded. Please try again shortly.", true);
	}
}

document.querySelectorAll<HTMLElement>("[data-catalog-view]").forEach((container) => {
	void loadCatalog(container);
});