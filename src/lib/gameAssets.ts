
import globalAssets from './globalAssets.json';
import trackAssets from './trackAssets';

export const ASSET_LIST = globalAssets;

export interface AssetPlacement {
    z: number;      // Lokasi di track (dalam satuan segment)
    side: 'left' | 'right'; // Sisi jalan
    src: string; // Langsung path gambar
    offset?: number; // Jarak dari pinggir jalan (opsional, jika tidak diisi akan pakai default)
}

// Konfigurasi manual untuk landmark atau aset spesial
// Ini akan menggantikan logic "random" untuk titik-titik tertentu
export const TRACK_ASSETS: AssetPlacement[] = trackAssets as AssetPlacement[];

// Helper untuk mendapatkan offset default berdasarkan sisi jalan
// Offset negatif = kiri, positif = kanan
export const getAssetOffset = (side: 'left' | 'right', assetName: string): number => {
    let baseOffset = side === 'left' ? -2.8 : 2.8;

    // Penyesuaian offset spesifik per tipe aset jika perlu
    // Penyesuaian offset spesifik per tipe aset jika perlu
    if (assetName.includes('pohon')) baseOffset = side === 'left' ? -5.5 : 5.5; // Next to/behind buildings (was 8.0)

    return baseOffset;
};
