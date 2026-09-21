import { fileURLToPath } from 'node:url';
import { assertDeliveryGalleryBuild } from './lib/ssh-deploy.js';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const result = assertDeliveryGalleryBuild(dist);
console.log(`Entregas: build completo, ${result.deliveries} registros e ${result.chunks} módulos verificados.`);
