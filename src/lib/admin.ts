import { ulid } from "ulid";
import type { Catalog, Photo, Piece, PieceStatus } from "../../shared/types";

interface SelectedPhoto {
	file?: File;
	photo?: Photo;
	alt: string;
	previewUrl: string;
}

const panel = document.querySelector<HTMLElement>("[data-admin-panel]");
if (panel) {
	const adminApp = panel.querySelector<HTMLElement>("[data-admin-app]")!;
	const loginView = panel.querySelector<HTMLElement>("[data-login-view]")!;
	const passwordForm = panel.querySelector<HTMLFormElement>("[data-password-form]")!;
	const passwordInput = passwordForm.querySelector<HTMLInputElement>("[name=password]")!;
	const loginError = panel.querySelector<HTMLElement>("[data-login-error]")!;
	const passwordSubmit = panel.querySelector<HTMLButtonElement>("[data-password-submit]")!;
	const biographyForm = panel.querySelector<HTMLFormElement>("[data-biography-form]")!;
	const biographyInput = biographyForm.querySelector<HTMLTextAreaElement>("[name=biography]")!;
	const biographyMessage = panel.querySelector<HTMLElement>("[data-biography-message]")!;
	const biographySave = panel.querySelector<HTMLButtonElement>("[data-biography-save]")!;
	const signOutButton = panel.querySelector<HTMLButtonElement>("[data-sign-out]")!;
	const listView = panel.querySelector<HTMLElement>("[data-list-view]")!;
	const formView = panel.querySelector<HTMLElement>("[data-form-view]")!;
	const listMessage = panel.querySelector<HTMLElement>("[data-list-message]")!;
	const pieceList = panel.querySelector<HTMLUListElement>("[data-piece-list]")!;
	const form = panel.querySelector<HTMLFormElement>("[data-knife-form]")!;
	const formEyebrow = panel.querySelector<HTMLElement>("[data-form-eyebrow]")!;
	const formTitle = panel.querySelector<HTMLElement>("[data-form-title]")!;
	const photoInput = panel.querySelector<HTMLInputElement>("[data-photo-input]")!;
	const folderInput = panel.querySelector<HTMLInputElement>("[data-folder-input]")!;
	const folderPicker = panel.querySelector<HTMLLabelElement>("[data-folder-picker]")!;
	const selectedPhotoList = panel.querySelector<HTMLOListElement>("[data-selected-photos]")!;
	const priceField = panel.querySelector<HTMLElement>("[data-price-field]")!;
	const errorMessage = panel.querySelector<HTMLElement>("[data-form-error]")!;
	const saveButton = panel.querySelector<HTMLButtonElement>("[data-save-button]")!;
	const deleteButton = panel.querySelector<HTMLButtonElement>("[data-delete-piece]")!;
	const uploadStatus = panel.querySelector<HTMLElement>("[data-upload-status]")!;
	const uploadMessage = panel.querySelector<HTMLElement>("[data-upload-message]")!;
	const uploadProgress = panel.querySelector<HTMLProgressElement>("[data-upload-progress]")!;
	const bulkStatus = panel.querySelector<HTMLElement>("[data-bulk-status]")!;
	const bulkMessage = panel.querySelector<HTMLElement>("[data-bulk-message]")!;
	const bulkProgress = panel.querySelector<HTMLProgressElement>("[data-bulk-progress]")!;
	const mediaBaseUrl = import.meta.env.PUBLIC_MEDIA_BASE_URL || "";
	let selectedPhotos: SelectedPhoto[] = [];
	let editingPieceId: string | undefined;
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

	function showLogin(message = ""): void {
		adminApp.hidden = true;
		loginView.hidden = false;
		loginError.textContent = message;
		loginError.hidden = !message;
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
			const editButton = document.createElement("button");
			editButton.type = "button";
			editButton.className = "quiet-button";
			editButton.textContent = "Edit";
			editButton.dataset.editPiece = piece.id;
			item.append(editButton);
			pieceList.append(item);
		}
	}

	async function loadCatalog(): Promise<void> {
		listMessage.textContent = "Loading your knives...";
		try {
			const response = await fetch("/api/catalog", { cache: "no-store" });
			if (!response.ok) {
				if (response.status === 401) {
					showLogin();
					return;
				}
				if (response.status === 403) {
					showLogin("This account does not have catalog access.");
					return;
				}
				throw new Error(await responseMessage(response));
			}
			catalog = (await response.json()) as Catalog;
			biographyInput.value = catalog.biography ?? biographyInput.value;
			loginView.hidden = true;
			adminApp.hidden = false;
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

	async function saveBiography(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		biographySave.disabled = true;
		biographyMessage.textContent = "Saving biography...";
		try {
			const response = await fetch("/api/site-content", {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ biography: biographyInput.value }),
			});
			if (!response.ok) throw new Error(await responseMessage(response));
			const saved = (await response.json()) as { biography: string };
			catalog.biography = saved.biography;
			biographyInput.value = saved.biography;
			biographyMessage.textContent = "Biography saved. The homepage will update shortly.";
		} catch (error) {
			biographyMessage.textContent = error instanceof Error ? error.message : "The biography could not be saved.";
		} finally {
			biographySave.disabled = false;
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
			const details = document.createElement("div");
			details.className = "selected-photo-details";
			const label = document.createElement("span");
			label.textContent = `${selected.file?.name || selected.photo?.id || `Photo ${index + 1}`}${index === 0 ? " - cover" : ""}`;
			const altLabel = document.createElement("label");
			altLabel.className = "photo-alt-field";
			altLabel.textContent = "Photo description";
			const altInput = document.createElement("input");
			altInput.type = "text";
			altInput.maxLength = 250;
			altInput.value = selected.alt;
			altInput.placeholder = "Describe this photo for accessibility";
			altInput.dataset.photoAltIndex = String(index);
			altLabel.append(altInput);
			details.append(label, altLabel);
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
			item.append(image, details, actions);
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
			request.open("POST", "/api/photos");
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

	async function prepareAndUploadPhoto(file: File, pieceId: string, onProgress: (percent: number) => void): Promise<Photo> {
		let bitmap: ImageBitmap;
		try {
			bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
		} catch {
			throw new Error("Couldn't read this photo. Try exporting it as JPEG or PNG.");
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
			return await uploadPhoto(uploadData, onProgress);
		} finally {
			bitmap.close();
		}
	}

	async function uploadFolder(files: FileList | null): Promise<void> {
		const images = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
		folderInput.value = "";
		if (!images.length) {
			bulkStatus.hidden = false;
			bulkMessage.textContent = "No supported photos were found in that folder.";
			bulkProgress.value = 0;
			return;
		}

		folderInput.disabled = true;
		folderPicker.setAttribute("aria-disabled", "true");
		bulkStatus.hidden = false;
		bulkProgress.value = 0;
		const failures: string[] = [];
		let createdCount = 0;
		for (const [index, file] of images.entries()) {
			const title = (file.name.replace(/\.[^.]+$/, "").trim() || "Untitled photo").slice(0, 120);
			const pieceId = ulid();
			bulkMessage.textContent = `Preparing ${index + 1} of ${images.length}: ${file.name}`;
			try {
				const photo = await prepareAndUploadPhoto(file, pieceId, (percent) => {
					bulkProgress.value = ((index + percent / 100) / images.length) * 100;
				});
				const saveResponse = await fetch(`/api/pieces/${pieceId}`, {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						title,
						description: "",
						status: "gallery",
						featured: false,
						photos: [{ ...photo, alt: title }],
					}),
				});
				if (!saveResponse.ok) throw new Error(await responseMessage(saveResponse));
				catalog.pieces.unshift((await saveResponse.json()) as Piece);
				createdCount += 1;
			} catch (error) {
				const reason = error instanceof Error ? error.message : "Upload failed.";
				failures.push(`${file.name}: ${reason}`);
			}
			bulkProgress.value = ((index + 1) / images.length) * 100;
		}

		renderPieces();
		folderInput.disabled = false;
		folderPicker.removeAttribute("aria-disabled");
		bulkMessage.textContent = failures.length
			? `Created ${createdCount} of ${images.length} entries. Failed: ${failures.join("; ")}`
			: `Created ${createdCount} entries, one for each photo.`;
	}

	async function saveKnife(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		errorMessage.hidden = true;
		if (!selectedPhotos.length) {
			setError("Add at least one photo before saving.");
			return;
		}
		const formData = new FormData(form);
		const pieceId = editingPieceId || ulid();
		const photos: Photo[] = [];
		const newPhotoCount = selectedPhotos.filter((selected) => selected.file).length;
		saveButton.disabled = true;
		uploadStatus.hidden = false;
		try {
			let uploadedCount = 0;
			for (const [index, selected] of selectedPhotos.entries()) {
				if (!selected.file) {
					if (!selected.photo) throw new Error("A photo could not be loaded. Reload the catalog and try again.");
					photos.push({ ...selected.photo, ...(selected.alt ? { alt: selected.alt } : {}) });
					continue;
				}
				uploadMessage.textContent = `Preparing photo ${uploadedCount + 1} of ${newPhotoCount}...`;
				const photo = await prepareAndUploadPhoto(selected.file, pieceId, (percent) => {
					uploadProgress.value = ((uploadedCount + percent / 100) / newPhotoCount) * 100;
				});
				photos.push({ ...photo, ...(selected.alt ? { alt: selected.alt } : {}) });
				uploadedCount += 1;
			}

			uploadMessage.textContent = "Saving knife details...";
			const saveResponse = await fetch(`/api/pieces/${pieceId}`, {
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
			const existingIndex = catalog.pieces.findIndex((piece) => piece.id === savedPiece.id);
			if (existingIndex === -1) catalog.pieces.unshift(savedPiece);
			else catalog.pieces[existingIndex] = savedPiece;
			form.reset();
			clearSelectedPhotos();
			editingPieceId = undefined;
			uploadStatus.hidden = true;
			setView(false);
			renderPieces();
			listMessage.textContent = "Saved! Your catalog will update in about a minute.";
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

	function startNewPiece(): void {
		editingPieceId = undefined;
		form.reset();
		formEyebrow.textContent = "New catalog entry";
		formTitle.textContent = "Add a knife";
		saveButton.textContent = "Save knife";
		deleteButton.hidden = true;
		priceField.hidden = true;
		clearSelectedPhotos();
		errorMessage.hidden = true;
		uploadProgress.value = 0;
		uploadStatus.hidden = true;
		setView(true);
	}

	function startEditingPiece(piece: Piece): void {
		editingPieceId = piece.id;
		form.reset();
		form.querySelector<HTMLInputElement>("[name=title]")!.value = piece.title;
		form.querySelector<HTMLTextAreaElement>("[name=description]")!.value = piece.description;
		form.querySelector<HTMLSelectElement>("[name=status]")!.value = piece.status;
		form.querySelector<HTMLInputElement>("[name=priceNote]")!.value = piece.priceNote || "";
		(form.querySelector<HTMLInputElement>("[name=featured]")!).checked = piece.featured;
		priceField.hidden = piece.status !== "available";
		formEyebrow.textContent = "Edit catalog entry";
		formTitle.textContent = piece.title;
		saveButton.textContent = "Save changes";
		deleteButton.hidden = false;
		clearSelectedPhotos();
		selectedPhotos = piece.photos.map((photo) => ({
			photo,
			alt: photo.alt || "",
			previewUrl: mediaUrl(photo.thumb),
		}));
		renderSelectedPhotos();
		errorMessage.hidden = true;
		uploadProgress.value = 0;
		uploadStatus.hidden = true;
		setView(true);
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
	panel.querySelector<HTMLButtonElement>("[data-add-knife]")!.addEventListener("click", startNewPiece);
	passwordForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		passwordSubmit.disabled = true;
		loginError.hidden = true;
		try {
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ password: passwordInput.value }),
			});
			if (!response.ok) throw new Error(await responseMessage(response));
			passwordForm.reset();
			await loadCatalog();
		} catch (error) {
			loginError.textContent = error instanceof Error ? error.message : "Password sign-in failed.";
			loginError.hidden = false;
			passwordInput.focus();
		} finally {
			passwordSubmit.disabled = false;
		}
	});
	signOutButton.addEventListener("click", async () => {
		signOutButton.disabled = true;
		try {
			await fetch("/api/auth/logout", { method: "POST" });
		} finally {
			window.location.assign("/logout");
		}
	});
	folderInput.addEventListener("change", () => void uploadFolder(folderInput.files));
	panel.querySelector<HTMLButtonElement>("[data-cancel]")!.addEventListener("click", () => {
		clearSelectedPhotos();
		editingPieceId = undefined;
		setView(false);
	});
	deleteButton.addEventListener("click", async () => {
		if (!editingPieceId) return;
		const title = form.querySelector<HTMLInputElement>("[name=title]")!.value;
		if (!window.confirm(`Permanently delete "${title}" and all its photos? This cannot be undone.`)) return;

		deleteButton.disabled = true;
		saveButton.disabled = true;
		uploadStatus.hidden = false;
		uploadMessage.textContent = "Deleting knife and photos...";
		errorMessage.hidden = true;
		try {
			const response = await fetch(`/api/pieces/${editingPieceId}`, { method: "DELETE" });
			if (!response.ok) throw new Error(await responseMessage(response));
			catalog.pieces = catalog.pieces.filter((piece) => piece.id !== editingPieceId);
			clearSelectedPhotos();
			form.reset();
			editingPieceId = undefined;
			uploadStatus.hidden = true;
			setView(false);
			renderPieces();
			listMessage.textContent = `Deleted “${title}” and its photos.`;
		} catch (error) {
			setError(error instanceof Error ? error.message : "The knife could not be deleted.");
		} finally {
			deleteButton.disabled = false;
			saveButton.disabled = false;
		}
	});
	panel.querySelector<HTMLSelectElement>("[name=status]")!.addEventListener("change", (event) => {
		priceField.hidden = (event.currentTarget as HTMLSelectElement).value !== "available";
	});
	photoInput.addEventListener("change", () => {
		const available = Math.max(0, 12 - selectedPhotos.length);
		const added = Array.from(photoInput.files || []).slice(0, available);
		selectedPhotos.push(...added.map((file) => ({ file, alt: "", previewUrl: URL.createObjectURL(file) })));
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
	selectedPhotoList.addEventListener("input", (event) => {
		const input = (event.target as HTMLElement).closest<HTMLInputElement>("[data-photo-alt-index]");
		if (input) selectedPhotos[Number(input.dataset.photoAltIndex)].alt = input.value;
	});
	pieceList.addEventListener("click", (event) => {
		const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-edit-piece]");
		if (!button) return;
		const piece = catalog.pieces.find((candidate) => candidate.id === button.dataset.editPiece);
		if (piece) startEditingPiece(piece);
	});
	form.addEventListener("submit", (event) => void saveKnife(event));
	biographyForm.addEventListener("submit", (event) => void saveBiography(event));
	void loadCatalog();
}