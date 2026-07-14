/**
 * Corrección de perspectiva ("aplanar" un documento fotografiado en ángulo).
 *
 * El usuario marca las 4 esquinas del documento y esto lo re-proyecta a un
 * rectángulo recto mediante una homografía. Canvas 2D solo soporta transformadas
 * afines (no perspectiva), por eso el warp se hace con WebGL.
 */

export interface Corner {
    /** 0..1 sobre el ancho de la imagen. */
    x: number;
    /** 0..1 sobre el alto de la imagen. */
    y: number;
}

/** Esquinas en orden: superior-izq, superior-der, inferior-der, inferior-izq. */
export type Corners = [Corner, Corner, Corner, Corner];

/**
 * Homografía que mapea el cuadrado unitario (0,0)(1,0)(1,1)(0,1) al
 * cuadrilátero `q` (mismos vértices en ese orden). Devuelve la matriz 3x3 en
 * orden column-major (apta para `gl.uniformMatrix3fv`). Un punto de salida uv se
 * transforma con `p = M * vec3(u, v, 1)`; la fuente es `p.xy / p.z`.
 * Método de Heckbert ("square to quad", Graphics Gems).
 */
export function squareToQuadMatrix(q: Corners): number[] {
    const [p0, p1, p2, p3] = q;
    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const dy3 = p0.y - p1.y + p2.y - p3.y;

    let a11: number, a21: number, a31: number;
    let a12: number, a22: number, a32: number;
    let a13: number, a23: number;

    if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
        // Caso afín (el cuadrilátero es un paralelogramo).
        a11 = p1.x - p0.x; a21 = p3.x - p0.x; a31 = p0.x;
        a12 = p1.y - p0.y; a22 = p3.y - p0.y; a32 = p0.y;
        a13 = 0; a23 = 0;
    } else {
        const den = dx1 * dy2 - dx2 * dy1;
        a13 = (dx3 * dy2 - dx2 * dy3) / den;
        a23 = (dx1 * dy3 - dx3 * dy1) / den;
        a11 = p1.x - p0.x + a13 * p1.x;
        a21 = p3.x - p0.x + a23 * p3.x;
        a31 = p0.x;
        a12 = p1.y - p0.y + a13 * p1.y;
        a22 = p3.y - p0.y + a23 * p3.y;
        a32 = p0.y;
    }

    // Column-major: col0=(a11,a12,a13) col1=(a21,a22,a23) col2=(a31,a32,1).
    return [a11, a12, a13, a21, a22, a23, a31, a32, 1];
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
        img.src = src;
    });
}

const VERT_SRC = `
attribute vec2 aPos;
attribute vec2 aUV;
varying vec2 vUV;
void main() {
    vUV = aUV;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision highp float;
uniform sampler2D uTex;
uniform mat3 uH;
varying vec2 vUV;
void main() {
    vec3 p = uH * vec3(vUV, 1.0);
    vec2 s = p.xy / p.z;
    if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
        return;
    }
    gl_FragColor = texture2D(uTex, s);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('No se pudo crear el shader.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(log || 'Error compilando el shader.');
    }
    return shader;
}

/**
 * Aplana la perspectiva de `src` usando las 4 esquinas normalizadas y devuelve
 * un objectURL PNG del rectángulo enderezado. El tamaño de salida se estima a
 * partir de los lados del cuadrilátero para preservar la resolución.
 */
export async function flattenPerspective(src: string, corners: Corners): Promise<string> {
    const image = await loadImage(src);
    const nw = image.naturalWidth;
    const nh = image.naturalHeight;

    const pts = corners.map((c) => ({ x: c.x * nw, y: c.y * nh }));
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        Math.hypot(a.x - b.x, a.y - b.y);
    const anchoArriba = dist(pts[0], pts[1]);
    const anchoAbajo = dist(pts[3], pts[2]);
    const altoIzq = dist(pts[0], pts[3]);
    const altoDer = dist(pts[1], pts[2]);

    const outW = Math.max(16, Math.min(Math.round(Math.max(anchoArriba, anchoAbajo)), nw * 3));
    const outH = Math.max(16, Math.min(Math.round(Math.max(altoIzq, altoDer)), nh * 3));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const gl = canvas.getContext('webgl', {
        preserveDrawingBuffer: true,
        premultipliedAlpha: false,
    });
    if (!gl) throw new Error('WebGL no está disponible en este dispositivo.');

    const program = gl.createProgram();
    if (!program) throw new Error('No se pudo crear el programa WebGL.');
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'Error enlazando WebGL.');
    }
    gl.useProgram(program);

    // Quad de pantalla completa (TRIANGLE_STRIP: TL, TR, BL, BR). uv con y hacia
    // abajo para que (0,0) sea la esquina superior-izquierda del resultado.
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const aUV = gl.getAttribLocation(program, 'aUV');
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Sin flip vertical: la coordenada de textura y=0 debe corresponder a la
    // fila superior de la imagen para que el resultado no salga espejado.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    gl.uniformMatrix3fv(gl.getUniformLocation(program, 'uH'), false, squareToQuadMatrix(corners));
    gl.uniform1i(gl.getUniformLocation(program, 'uTex'), 0);

    gl.viewport(0, 0, outW, outH);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));

    gl.deleteTexture(tex);
    gl.deleteBuffer(posBuf);
    gl.deleteBuffer(uvBuf);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    gl.deleteProgram(program);

    if (!blob) throw new Error('No se pudo aplanar la imagen.');
    return URL.createObjectURL(blob);
}
