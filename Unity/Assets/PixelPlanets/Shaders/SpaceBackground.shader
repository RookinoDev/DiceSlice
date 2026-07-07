// Procedural deep-space backdrop: multi-layer parallax starfield + soft nebula.
Shader "PixelPlanets/SpaceBackground"
{
    Properties
    {
        _PlanetTime ("Time",       Float) = 0
        _Seed       ("Seed",       Float) = 1
        _Neb1       ("Nebula 1",   Color) = (0.10, 0.05, 0.22, 1)
        _Neb2       ("Nebula 2",   Color) = (0.02, 0.12, 0.24, 1)
        _NebAmount  ("Neb Amount", Float) = 1
        _Aspect     ("Aspect",     Float) = 1.777
    }
    SubShader
    {
        Tags { "Queue"="Background" "RenderType"="Opaque" }
        ZWrite Off Cull Off ZTest Always
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            float  _PlanetTime, _Seed, _NebAmount, _Aspect;
            float4 _Neb1, _Neb2;

            struct a2v { float4 vertex:POSITION; float2 uv:TEXCOORD0; };
            struct v2f { float4 pos:SV_POSITION; float2 uv:TEXCOORD0; };

            v2f vert(a2v v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = v.uv; return o; }

            float hash21(float2 p) {
                p = frac(p * float2(123.34, 456.21) + _Seed);
                p += dot(p, p + 45.32);
                return frac(p.x * p.y);
            }
            float2 hash22(float2 p) { float n = hash21(p); return float2(n, hash21(p + n)); }

            float vnoise(float2 p) {
                float2 i = floor(p), f = frac(p);
                float2 u = f*f*(3-2*f);
                float a = hash21(i), b = hash21(i+float2(1,0)),
                      c = hash21(i+float2(0,1)), d = hash21(i+float2(1,1));
                return lerp(lerp(a,b,u.x), lerp(c,d,u.x), u.y);
            }
            float fbm(float2 p) {
                float v = 0, s = 0.5;
                for (int i = 0; i < 5; i++) { v += vnoise(p)*s; p *= 2; s *= 0.5; }
                return v;
            }

            // One star per grid cell; density + drift differ per layer → parallax.
            float starLayer(float2 uv, float density, float drift) {
                uv.x += _PlanetTime * drift;
                float2 g  = uv * density;
                float2 id = floor(g);
                float2 f  = frac(g);
                float2 pos = hash22(id);
                float  d   = length(f - pos);
                float  br  = hash21(id + 7.7);
                float  s   = smoothstep(0.07, 0.0, d) * step(0.62, br) * br;
                s *= 0.6 + 0.4 * sin(_PlanetTime * 2.0 + br * 30.0);   // twinkle
                return s;
            }

            fixed4 frag(v2f i) : SV_Target {
                float2 uv = i.uv;
                uv.x *= _Aspect;   // keep stars round regardless of screen aspect

                float3 col = float3(0.020, 0.020, 0.045);

                // Nebula: two fbm fields multiplied for wispy clumps
                float n1  = fbm(uv * 3.0 + float2(_PlanetTime * 0.005, 0));
                float n2  = fbm(uv * 6.0 + 10.0 - float2(_PlanetTime * 0.008, 0));
                float neb = saturate(n1 * n2 * 2.2) * _NebAmount;
                col = lerp(col, _Neb1.rgb, neb * 0.70);
                col = lerp(col, _Neb2.rgb, neb * neb * 0.55);

                // Stars are drawn as PNG sprites (StarSprite) — background is nebula only.
                return float4(col, 1);
            }
            ENDCG
        }
    }
}
