// Serviço de Branding/Logos por projeto
import { db, storage } from '../config/firebase.js';
import { auth } from '../config/firebase.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const COLLECTION = 'projects';

export async function getBranding(projectId) {
  const snap = await getDoc(doc(db, COLLECTION, projectId));
  if (!snap.exists()) throw new Error('Projeto não encontrado');
  const data = snap.data() || {};
  return data.branding || {};
}

export async function saveBranding(projectId, branding) {
  const refDoc = doc(db, COLLECTION, projectId);
  // usar setDoc com merge para evitar erros em docs sem o campo
  await setDoc(refDoc, { branding }, { merge: true });
  return true;
}

export async function uploadLogo(projectId, file, pathKey) {
  if (!file) return null;
  const fileName = `${pathKey}-${Date.now()}-${file.name}`;
  const fileRef = ref(storage, `projects/${projectId}/branding/${fileName}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}


