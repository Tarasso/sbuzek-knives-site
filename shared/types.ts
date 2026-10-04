export type PieceStatus = "gallery" | "available" | "hidden";

export interface Photo {
	id: string;
	width: number;
	height: number;
	alt?: string;
	thumb: string;
	display: string;
	full: string;
}

export interface Piece {
	id: string;
	slug: string;
	title: string;
	description: string;
	status: PieceStatus;
	priceNote?: string;
	featured: boolean;
	sortOrder: number;
	photos: Photo[];
	createdAt: string;
	updatedAt: string;
	legacy?: {
		source: "wix-gallery" | "wix-gallery-2" | "wix-home";
		wixMediaIds: string[];
	};
}

export interface Catalog {
	schemaVersion: 1;
	updatedAt: string;
	pieces: Piece[];
}