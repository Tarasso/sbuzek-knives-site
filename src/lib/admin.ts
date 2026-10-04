import { ulid } from "ulid";
import type { Catalog, Photo, Piece, PieceStatus } from "../../shared/types";

interface SelectedPhoto {
	file: File;
	previewUrl: string;
}

const panel = document.querySelector<HTMLElement>("[data-admin-panel]");
if (panel) {
	const listView = panel.querySelector<HTMLElement>("[data-list-view]")!;
	const formView = panel.querySelector<HTMLElement>("[data-form-view]")!;
	const listMessage = panel.querySelector<HTMLElement>("[data-list-message]")!;
	const pieceList = panel.querySelector<HTMLUListElement>("[data-piece-list]")!;
	const form = panel.querySelector<HTMLFormElement>("[data-knife-form]")!;
	const photoInput = panel.querySelector<HTMLInputElement>("[data-photo-input]")!;
	const selectedPhotoList = panel.querySelector<HTMLOListElement>("[data-selected-photos]")!;
	const priceField = panel.querySelector<HTMLElement>("[data-price-field]")!;
	const errorMessage = panel.querySelector<HTMLElement>("[data-form-error]")!;
	const saveButton = panel.querySelector<HTMLButtonElement>("[data-save-button]")!;
	const uploadStatus = panel.querySelector<HTMLElement>("[data-upload-status]")!;
	const uploadMessage = panel.querySelector<HTMLElement>("[data-upload-message]")!;
	const uploadProgress = panel.querySelector<HTMLProgressElement>("[data-upload-progress]")!;
	const mediaBaseUrl = import.meta.env.PUBLIC_MEDIA_BASE_URL || "";
	let selectedPhotos: SelectedPhoto[] = [];
	let catalog: Catalog = { schemaVersion: 1, updatedAt: "", pieces: [] };

	function setError(message: string): void {
		errorMessage.textContent = message;
		errorMessage.hidden = false;
	}

	function mediaUrl(path: string): string {
		return new URL(path, mediaBaseUrl.endsWith("/") ? mediaBaseUrl : `${mediaBaseUrl}/`).toString();
	}

	function setView(showForm: boolean): void {
		listView.hidden = showForm;
		formView.hidden = !showForm;
		if (showForm) form.querySelector<HTMLInputElement>("[name=title]")?.focus();
	}

	function renderPieces(): void {
		pieceList.replaceChildren();
		const ordered = [...catalog.pieces].sort((first, second) => first.sortOrder - second.sortOrder);
		if (!ordered.length) {
			listMessage.textContent = "No knives yet. Add your first one when you're ready.";
			return;
		}
		listMessage.textContent = "";
		for (const piece of ordered) {
			const item = document.createElement("li");
			item.className = "admin-piece-row";
			const photo = piece.photos[0];
			if (photo) {
				const image = document.createElement("img");
				image.src = mediaUrl(photo.thumb);
				image.alt = photo.alt || `${piece.title} cover`;
				image.width = 100;
				image.height = 76;
				item.append(image);
			}
			const details = document.createElement("div");
			details.className = "admin-piece-details";
			const title = document.createElement("h2");
			title.textContent = piece.title;
			const status = document.createElement("p");
			status.textContent = piece.status === "available" ? "For sale" : piece.status === "hidden" ? "Hidden" : "On site";
			details.append(title, status);
			item.append(details);
			pieceList.append(item);
		}
	}

	async function loadCatalog(): Promise<void> {
		listMessage.textContent = "Loading your knives...";
		try {
			const response = await fetch("/api/admin/catalog", { cache: "no-store" });
			if (!response.ok) throw new Error(await responseMessage(response));
			catalog = (await response.json()) as Catalog;
			renderPieces();
		} catch (error) {
			listMessage.textContent = error instanceof Error ? error.message : "The catalog could not be loaded.";
		}
	}

	async function responseMessage(response: Response): Promise<string> {
		try {
			const body = (await response.json()) as { error?: string };
			return body.error || `Request failed (${response.status}).`;
		} catch {
			return `Request failed (${response.status}).`;
		}
	}

	function renderSelectedPhotos(): void {
		selectedPhotoList.replaceChildren();
		for (const [index, selected] of selectedPhotos.entries()) {
			const item = document.createElement("li");
			item.className = "selected-photo-row";
			const image = document.createElement("img");
			image.src = selected.previewUrl;
			image.alt = `Selected photo ${index + 1}`;
			const label = document.createElement("span");
			label.textContent = index === 0 ? `${selected.file.name} - cover` : selected.file.name;
			const actions = document.createElement("div");
			actions.className = "photo-actions";
			for (const [action, text, disabled] of [
				["up", "Move up", index === 0],
				["down", "Move down", index === selectedPhotos.length - 1],
				["remove", "Remove", false],
			] as const) {
				const button = document.createElement("button");
				button.type = "button";
				button.className = "quiet-button";
				button.textContent = text;
				button.dataset.photoAction = action;
				button.dataset.photoIndex = String(index);
				button.disabled = disabled;
				actions.append(button);
			}
			item.append(image, label, actions);
			selectedPhotoList.append(item);
		}
	}

	function toJpeg(bitmap: ImageBitmap, edge: number, quality: number): Promise<{ file: File; width: number; height: number }> {
		const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) return Promise.reject(new Error("This browser could not prepare the photo."));
		context.drawImage(bitmap, 0, 0, width, height);
		return new Promise((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (!blob) {
					reject(new Error("This photo could not be converted to JPEG."));
					return;
				}
				resolve({ file: new File([blob], "photo.jpg", { type: "image/jpeg" }), width, height });
			}, "image/jpeg", quality);
		});
	}

	function uploadPhoto(data: FormData, onProgress: (percent: number) => void): Promise<Photo> {
		return new Promise((resolve, reject) => {
			const request = new XMLHttpRequest();
			request.open("POST", "/api/admin/photos");
			request.upload.onprogress = (event) => {
				if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
			};
			request.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
			request.onload = () => {
				try {
					const body = JSON.parse(request.responseText || "{}") as { error?: string } & Photo;
					if (request.status < 200 || request.status >= 300) {
						reject(new Error(body.error || `Photo upload failed (${request.status}).`));
						return;
					}
					resolve(body);
				} catch {
					reject(new Error(`Photo upload failed (${request.status}).`));
				}
			};
			request.send(data);
		});
	}

	async function saveKnife(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		errorMessage.hidden = true;
		if (!selectedPhotos.length) {
			setError("Add at least one photo before saving.");
			return;
		}
		const formData = new FormData(form);
		const pieceId = ulid();
		const photos: Photo[] = [];
		saveButton.disabled = true;
		uploadStatus.hidden = false;
		try {
			for (const [index, selected] of selectedPhotos.entries()) {
				uploadMessage.textContent = `Preparing photo ${index + 1} of ${selectedPhotos.length}...`;
				let bitmap: ImageBitmap;
				try {
					bitmap = await createImageBitmap(selected.file, { imageOrientation: "from-image" });
				} catch {
					throw new Error("Couldn't read this photo. Try taking a screenshot or exporting it as JPEG.");
				}
				try {
					const [thumb, display, full] = await Promise.all([
						toJpeg(bitmap, 640, 0.8),
						toJpeg(bitmap, 1600, 0.85),
						toJpeg(bitmap, 2560, 0.88),
					]);
					const photoId = ulid();
					const uploadData = new FormData();
					uploadData.set("pieceId", pieceId);
					uploadData.set("photoId", photoId);
					uploadData.set("width", String(full.width));
					uploadData.set("height", String(full.height));
					uploadData.set("thumb", thumb.file);
					uploadData.set("display", display.file);
					uploadData.set("full", full.file);
					uploadMessage.textContent = `Uploading photo ${index + 1} of ${selectedPhotos.length}...`;
					const photo = await uploadPhoto(uploadData, (percent) => {
						uploadProgress.value = ((index + percent / 100) / selectedPhotos.length) * 100;
					});
					photos.push(photo);
				} finally {
					bitmap.close();
				}
			}

			uploadMessage.textContent = "Saving knife details...";
			const saveResponse = await fetch(`/api/admin/pieces/${pieceId}`, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					title: formData.get("title"),
					description: formData.get("description"),
					status: formData.get("status") as PieceStatus,
					priceNote: formData.get("priceNote"),
					featured: formData.has("featured"),
					photos,
				}),
			});
			if (!saveResponse.ok) throw new Error(await responseMessage(saveResponse));
			const savedPiece = (await saveResponse.json()) as Piece;
			catalog.pieces.unshift(savedPiece);
			form.reset();
			clearSelectedPhotos();
			uploadStatus.hidden = true;
			setView(false);
			renderPieces();
			listMessage.textContent = "Saved! It'll show on your site in about a minute.";
		} catch (error) {
			setError(error instanceof Error ? error.message : "The knife could not be saved.");
		} finally {
			saveButton.disabled = false;
		}
	}

	function clearSelectedPhotos(): void {
		for (const selected of selectedPhotos) URL.revokeObjectURL(selected.previewUrl);
		selectedPhotos = [];
		photoInput.value = "";
		renderSelectedPhotos();
	}

	const userName = panel.querySelector<HTMLElement>("[data-user-name]")!;
	void fetch("/.auth/me", { cache: "no-store" })
		.then((response) => response.json())
		.then((data: { clientPrincipal?: { userDetails?: string } }) => {
			userName.textContent = data.clientPrincipal?.userDetails || "Administrator";
		})
		.catch(() => {
			userName.textContent = "Administrator";
		});
	panel.querySelector<HTMLButtonElement>("[data-add-knife]")!.addEventListener("click", () => {
		form.reset();
		priceField.hidden = true;
		clearSelectedPhotos();
		errorMessage.hidden = true;
		uploadProgress.value = 0;
		uploadStatus.hidden = true;
		setView(true);
	});
	panel.querySelector<HTMLButtonElement>("[data-cancel]")!.addEventListener("click", () => setView(false));
	panel.querySelector<HTMLSelectElement>("[name=status]")!.addEventListener("change", (event) => {
		priceField.hidden = (event.currentTarget as HTMLSelectElement).value !== "available";
	});
	photoInput.addEventListener("change", () => {
		const available = 12 - selectedPhotos.length;
		const added = Array.from(photoInput.files || []).slice(0, available);
		selectedPhotos.push(...added.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })));
		if ((photoInput.files?.length || 0) > available) setError("You can add up to 12 photos.");
		else errorMessage.hidden = true;
		photoInput.value = "";
		renderSelectedPhotos();
	});
	selectedPhotoList.addEventListener("click", (event) => {
		const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-photo-action]");
		if (!button) return;
		const index = Number(button.dataset.photoIndex);
		const action = button.dataset.photoAction;
		if (action === "remove") {
			URL.revokeObjectURL(selectedPhotos[index].previewUrl);
			selectedPhotos.splice(index, 1);
		} else {
			const target = action === "up" ? index - 1 : index + 1;
			[selectedPhotos[index], selectedPhotos[target]] = [selectedPhotos[target], selectedPhotos[index]];
		}
		renderSelectedPhotos();
	});
	form.addEventListener("submit", (event) => void saveKnife(event));
	void loadCatalog();
}