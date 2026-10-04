import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { ContainerClient } from "@azure/storage-blob";

type PieceStatus = "gallery" | "available" | "hidden";

interface Photo {
	id: string;
	width: number;
	height: number;
	alt?: string;
	thumb: string;
	display: string;
	full: string;
}

interface PieceInput {
	title: string;
	description: string;
	status: PieceStatus;
	priceNote?: string;
	featured: boolean;
	photos: Photo[];
}

interface Piece extends PieceInput {
	id: string;
	slug: string;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

interface Catalog {
	schemaVersion: 1;
	updatedAt: string;
	pieces: Piece[];
}

const ulidPattern = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const photoVariants = ["thumb", "display", "full"] as const;
const maxPhotoBytes = 8 * 1024 * 1024;
const maxPhotoRequestBytes = 28 * 1024 * 1024;

function response(status: number, body: unknown, headers: Record<string, string> = {}): HttpResponseInit {
	return {
		status,
		headers: { "content-type": "application/json; charset=utf-8", ...headers },
		jsonBody: body,
	};
}

function adminError(request: HttpRequest): HttpResponseInit | undefined {
	const principalHeader = request.headers.get("x-ms-client-principal");
	if (!principalHeader) return response(401, { error: "Sign in to manage the catalog." });
	try {
		const principal = JSON.parse(Buffer.from(principalHeader, "base64").toString("utf8")) as { userRoles?: string[] };
		if (!principal.userRoles?.some((role) => role.toLowerCase() === "admin")) {
			return response(403, { error: "This account does not have catalog access." });
		}
	} catch {
		return response(401, { error: "The sign-in information could not be verified." });
	}
	return undefined;
}

function mediaContainer(): ContainerClient {
	const encodedSasUrl = process.env.MEDIA_CONTAINER_SAS_URL_B64;
	if (!encodedSasUrl) throw new Error("The media container setting is missing.");
	const sasUrl = Buffer.from(encodedSasUrl, "base64").toString("utf8");
	return new ContainerClient(sasUrl);
}

function isUlid(value: unknown): value is string {
	return typeof value === "string" && ulidPattern.test(value);
}

function slugFor(title: string, id: string): string {
	const titleSlug = title
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	return `${titleSlug || "knife"}-${id.slice(-6).toLowerCase()}`;
}

async function readCatalog(container: ContainerClient): Promise<{ catalog: Catalog; etag: string }> {
	const blob = container.getBlockBlobClient("catalog.json");
	const properties = await blob.getProperties();
	if (!properties.etag) throw new Error("The catalog does not have an ETag.");
	const data = await blob.downloadToBuffer();
	const catalog = JSON.parse(data.toString("utf8")) as Catalog;
	if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.pieces)) {
		throw new Error("The catalog schema is invalid.");
	}
	return { catalog, etag: properties.etag };
}

async function catalogHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
	const denied = adminError(request);
	if (denied) return denied;
	try {
		const { catalog, etag } = await readCatalog(mediaContainer());
		return response(200, catalog, { etag, "cache-control": "no-store" });
	} catch (error) {
		context.error("Could not read the catalog.", error);
		return response(500, { error: "The catalog could not be loaded." });
	}
}

async function photoHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
	const denied = adminError(request);
	if (denied) return denied;
	try {
		const form = await request.formData();
		const pieceId = form.get("pieceId");
		const photoId = form.get("photoId");
		const width = Number(form.get("width"));
		const height = Number(form.get("height"));
		if (!isUlid(pieceId) || !isUlid(photoId) || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
			return response(400, { error: "The photo details are invalid." });
		}

		const files = photoVariants.map((variant) => form.get(variant));
		if (files.some((file) => !(file instanceof File) || file.type !== "image/jpeg" || file.size > maxPhotoBytes)) {
				return response(400, { error: "Each photo variant must be a JPEG under 8 MB." });
		}
		if (files.reduce((sum, file) => sum + (file instanceof File ? file.size : 0), 0) > maxPhotoRequestBytes) {
			return response(413, { error: "The resized photo set is too large. Choose a smaller original photo." });
		}

		const container = mediaContainer();
		for (const [index, variant] of photoVariants.entries()) {
			const file = files[index] as File;
			const path = `pieces/${pieceId}/${photoId}-${variant}.jpg`;
			await container.getBlockBlobClient(path).uploadData(Buffer.from(await file.arrayBuffer()), {
				blobHTTPHeaders: {
					blobContentType: "image/jpeg",
					blobCacheControl: "public, max-age=31536000, immutable",
				},
			});
		}

		const photo: Photo = {
			id: photoId,
			width,
			height,
			thumb: `pieces/${pieceId}/${photoId}-thumb.jpg`,
			display: `pieces/${pieceId}/${photoId}-display.jpg`,
			full: `pieces/${pieceId}/${photoId}-full.jpg`,
		};
		return response(201, photo);
	} catch (error) {
		context.error("Could not upload photo variants.", error);
		return response(500, { error: "The photos could not be uploaded." });
	}
}

function validatePiece(value: unknown, id: string): PieceInput | string {
	if (!value || typeof value !== "object" || Array.isArray(value)) return "Knife details are invalid.";
	const input = value as Record<string, unknown>;
	const allowed = new Set(["title", "description", "status", "priceNote", "featured", "photos"]);
	if (Object.keys(input).some((key) => !allowed.has(key))) return "Knife details contain an unknown field.";
	if (typeof input.title !== "string" || input.title.trim().length < 1 || input.title.length > 120) return "Title must be 1 to 120 characters.";
	if (typeof input.description !== "string" || input.description.length > 4000) return "Description must be 4,000 characters or fewer.";
	if (input.status !== "gallery" && input.status !== "available") return "Choose Gallery or For sale.";
	if (typeof input.featured !== "boolean") return "Home-page setting is invalid.";
	if (input.priceNote !== undefined && (typeof input.priceNote !== "string" || input.priceNote.length > 200)) return "Price note must be 200 characters or fewer.";
	if (!Array.isArray(input.photos) || input.photos.length < 1 || input.photos.length > 12) return "Add between 1 and 12 photos.";
	for (const photo of input.photos) {
		if (!photo || typeof photo !== "object" || !isUlid(photo.id)) return "A photo ID is invalid.";
		const item = photo as Record<string, unknown>;
		if (!Number.isInteger(item.width) || !Number.isInteger(item.height) || Number(item.width) < 1 || Number(item.height) < 1) return "Photo dimensions are invalid.";
		for (const variant of photoVariants) {
			if (item[variant] !== `pieces/${id}/${item.id}-${variant}.jpg`) return "A photo path is invalid.";
		}
		if (item.alt !== undefined && (typeof item.alt !== "string" || item.alt.length > 250)) return "Photo description is too long.";
	}
	return {
		title: input.title.trim(),
		description: input.description,
		status: input.status,
		...(typeof input.priceNote === "string" && input.priceNote.trim() ? { priceNote: input.priceNote.trim() } : {}),
		featured: input.featured,
		photos: input.photos as Photo[],
	};
}

async function removeUnreferencedPhotos(container: ContainerClient, piece: Piece): Promise<void> {
	const referenced = new Set(piece.photos.flatMap((photo) => photoVariants.map((variant) => `pieces/${piece.id}/${photo.id}-${variant}.jpg`)));
	for await (const blob of container.listBlobsFlat({ prefix: `pieces/${piece.id}/` })) {
		if (!referenced.has(blob.name)) await container.deleteBlob(blob.name);
	}
}

async function savePieceHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
	const denied = adminError(request);
	if (denied) return denied;
	const id = request.params.id;
	if (!isUlid(id)) return response(400, { error: "The knife ID is invalid." });
	let input: unknown;
	try {
		input = await request.json();
	} catch {
		return response(400, { error: "Knife details must be valid JSON." });
	}
	const validated = validatePiece(input, id);
	if (typeof validated === "string") return response(400, { error: validated });

	try {
		const container = mediaContainer();
		const catalogBlob = container.getBlockBlobClient("catalog.json");
		for (let attempt = 0; attempt < 3; attempt += 1) {
			const { catalog, etag } = await readCatalog(container);
			const existing = catalog.pieces.find((piece) => piece.id === id);
			const now = new Date().toISOString();
			const piece: Piece = {
				...validated,
				id,
				slug: slugFor(validated.title, id),
				sortOrder: existing?.sortOrder ?? Math.min(0, ...catalog.pieces.map((item) => item.sortOrder - 1)),
				createdAt: existing?.createdAt ?? now,
				updatedAt: now,
			};
			const pieces = existing
				? catalog.pieces.map((item) => item.id === id ? piece : item)
				: [piece, ...catalog.pieces];
			const updated: Catalog = { schemaVersion: 1, updatedAt: now, pieces };
			try {
				await catalogBlob.uploadData(Buffer.from(JSON.stringify(updated)), {
					blobHTTPHeaders: { blobContentType: "application/json", blobCacheControl: "public, max-age=60" },
					conditions: { ifMatch: etag },
				});
				await removeUnreferencedPhotos(container, piece);
				return response(200, piece);
			} catch (error) {
				if ((error as { statusCode?: number }).statusCode !== 412 || attempt === 2) throw error;
			}
		}
		return response(409, { error: "The catalog changed repeatedly. Please try saving again." });
	} catch (error) {
		context.error("Could not save the knife.", error);
		return response(500, { error: "The knife could not be saved." });
	}
}

app.http("adminCatalog", {
	methods: ["GET"],
	authLevel: "anonymous",
	route: "admin/catalog",
	handler: catalogHandler,
});

app.http("adminPhotos", {
	methods: ["POST"],
	authLevel: "anonymous",
	route: "admin/photos",
	handler: photoHandler,
});

app.http("adminSavePiece", {
	methods: ["PUT"],
	authLevel: "anonymous",
	route: "admin/pieces/{id}",
	handler: savePieceHandler,
});