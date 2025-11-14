declare module 'pdf-lib' {
  export class PDFDocument {
    static create(): Promise<PDFDocument>;
    addPage(size?: [number, number]): any;
    save(): Promise<Uint8Array>;
    embedFont(name: any): Promise<any>;
  }
  export enum StandardFonts {
    Helvetica = 'Helvetica',
  }
  export function rgb(r: number, g: number, b: number): any;
}


