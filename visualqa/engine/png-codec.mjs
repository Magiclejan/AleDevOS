import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SIG = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
let CRC_TABLE = null;
function crcTable(){
  if(CRC_TABLE) return CRC_TABLE;
  CRC_TABLE = new Uint32Array(256);
  for(let n=0;n<256;n++){
    let c=n;
    for(let k=0;k<8;k++) c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
    CRC_TABLE[n]=c>>>0;
  }
  return CRC_TABLE;
}
export function crc32(buf){
  const t=crcTable(); let c=0xffffffff;
  for(const b of buf) c=t[(c^b)&0xff]^(c>>>8);
  return (c^0xffffffff)>>>0;
}
function chunk(type,data){
  const t=Buffer.from(type,'ascii');
  const len=Buffer.alloc(4); len.writeUInt32BE(data.length,0);
  const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t,data])),0);
  return Buffer.concat([len,t,data,crc]);
}
function paeth(a,b,c){
  const p=a+b-c, pa=Math.abs(p-a), pb=Math.abs(p-b), pc=Math.abs(p-c);
  return pa<=pb&&pa<=pc?a:pb<=pc?b:c;
}
export function decodePng(input){
  const b=Buffer.isBuffer(input)?input:fs.readFileSync(input);
  if(b.length<8||!b.subarray(0,8).equals(SIG)) throw Object.assign(new Error('PNG_SIGNATURE_INVALID'),{code:'PNG_SIGNATURE_INVALID'});
  let off=8, ihdr=null, palette=null, trns=null; const idat=[];
  while(off+12<=b.length){
    const len=b.readUInt32BE(off); off+=4;
    const type=b.subarray(off,off+4).toString('ascii'); off+=4;
    if(off+len+4>b.length) throw Object.assign(new Error('PNG_CHUNK_TRUNCATED'),{code:'PNG_CHUNK_TRUNCATED'});
    const data=b.subarray(off,off+len); off+=len;
    const expected=b.readUInt32BE(off); off+=4;
    const actual=crc32(Buffer.concat([Buffer.from(type,'ascii'),data]));
    if(expected!==actual) throw Object.assign(new Error(`PNG_CRC_INVALID:${type}`),{code:'PNG_CRC_INVALID'});
    if(type==='IHDR') ihdr=Buffer.from(data);
    else if(type==='PLTE') palette=Buffer.from(data);
    else if(type==='tRNS') trns=Buffer.from(data);
    else if(type==='IDAT') idat.push(Buffer.from(data));
    else if(type==='IEND') break;
  }
  if(!ihdr||ihdr.length!==13||!idat.length) throw Object.assign(new Error('PNG_STRUCTURE_INVALID'),{code:'PNG_STRUCTURE_INVALID'});
  const width=ihdr.readUInt32BE(0), height=ihdr.readUInt32BE(4), bitDepth=ihdr[8], colorType=ihdr[9], compression=ihdr[10], filter=ihdr[11], interlace=ihdr[12];
  if(!width||!height) throw Object.assign(new Error('PNG_DIMENSIONS_INVALID'),{code:'PNG_DIMENSIONS_INVALID'});
  if(bitDepth!==8||compression!==0||filter!==0||interlace!==0) throw Object.assign(new Error('PNG_FORMAT_UNSUPPORTED'),{code:'PNG_FORMAT_UNSUPPORTED'});
  const channels={0:1,2:3,3:1,4:2,6:4}[colorType];
  if(!channels) throw Object.assign(new Error('PNG_COLOR_TYPE_UNSUPPORTED'),{code:'PNG_COLOR_TYPE_UNSUPPORTED'});
  if(colorType===3&&(!palette||palette.length<3)) throw Object.assign(new Error('PNG_PALETTE_MISSING'),{code:'PNG_PALETTE_MISSING'});
  const raw=zlib.inflateSync(Buffer.concat(idat));
  const stride=width*channels, expected=(stride+1)*height;
  if(raw.length!==expected) throw Object.assign(new Error('PNG_DATA_LENGTH_INVALID'),{code:'PNG_DATA_LENGTH_INVALID'});
  const scan=Buffer.alloc(stride*height); let rp=0;
  for(let y=0;y<height;y++){
    const ft=raw[rp++]; const rowOff=y*stride, prevOff=(y-1)*stride;
    for(let x=0;x<stride;x++){
      const val=raw[rp++], a=x>=channels?scan[rowOff+x-channels]:0, bb=y>0?scan[prevOff+x]:0, c=(y>0&&x>=channels)?scan[prevOff+x-channels]:0;
      let out;
      if(ft===0) out=val;
      else if(ft===1) out=(val+a)&255;
      else if(ft===2) out=(val+bb)&255;
      else if(ft===3) out=(val+Math.floor((a+bb)/2))&255;
      else if(ft===4) out=(val+paeth(a,bb,c))&255;
      else throw Object.assign(new Error('PNG_FILTER_UNSUPPORTED'),{code:'PNG_FILTER_UNSUPPORTED'});
      scan[rowOff+x]=out;
    }
  }
  const rgba=Buffer.alloc(width*height*4); let si=0, di=0;
  for(let i=0;i<width*height;i++){
    if(colorType===0){const g=scan[si++];rgba[di++]=g;rgba[di++]=g;rgba[di++]=g;rgba[di++]=255;}
    else if(colorType===2){rgba[di++]=scan[si++];rgba[di++]=scan[si++];rgba[di++]=scan[si++];rgba[di++]=255;}
    else if(colorType===3){const idx=scan[si++], po=idx*3;if(po+2>=palette.length)throw Object.assign(new Error('PNG_PALETTE_INDEX_INVALID'),{code:'PNG_PALETTE_INDEX_INVALID'});rgba[di++]=palette[po];rgba[di++]=palette[po+1];rgba[di++]=palette[po+2];rgba[di++]=trns&&idx<trns.length?trns[idx]:255;}
    else if(colorType===4){const g=scan[si++],a=scan[si++];rgba[di++]=g;rgba[di++]=g;rgba[di++]=g;rgba[di++]=a;}
    else {rgba[di++]=scan[si++];rgba[di++]=scan[si++];rgba[di++]=scan[si++];rgba[di++]=scan[si++];}
  }
  return {width,height,rgba};
}
export function encodePng({width,height,rgba}){
  if(!Number.isInteger(width)||width<1||!Number.isInteger(height)||height<1) throw new Error('PNG_DIMENSIONS_INVALID');
  const pix=Buffer.isBuffer(rgba)?rgba:Buffer.from(rgba||[]);
  if(pix.length!==width*height*4) throw new Error('PNG_RGBA_LENGTH_INVALID');
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(width,0); ihdr.writeUInt32BE(height,4); ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  const stride=width*4, raw=Buffer.alloc((stride+1)*height); let o=0;
  for(let y=0;y<height;y++){raw[o++]=0;pix.copy(raw,o,y*stride,(y+1)*stride);o+=stride;}
  return Buffer.concat([SIG,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
export function writePng(file,image){fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});fs.writeFileSync(file,encodePng(image));}
