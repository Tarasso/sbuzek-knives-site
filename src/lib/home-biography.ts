import type { Catalog } from "../../shared/types";

const catalogUrl = import.meta.env.PUBLIC_CATALOG_URL || "/catalog.json";
const biography = document.querySelector<HTMLElement>("[data-home-biography]");

if (biography) {
	void fetch(catalogUrl)
		.then((response) => {
			if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
			return response.json() as Promise<Catalog>;
		})
		.then((catalog) => {
			if (typeof catalog.biography === "string") biography.textContent = catalog.biography;
		})
		.catch(() => undefined);
}