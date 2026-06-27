// Toon Asteroid — smooth irregular rock, no pixelation
Shader "PixelPlanets/Asteroid"
{
    Properties
    {
        _Rotation    ("Rotation",     Float)  = 0
        _LightOrigin ("Light Origin", Vector) = (0.39,0.39,0,0)
        _Size        ("Size",         Float)  = 50
        _Octaves     ("Octaves",      Int)    = 4
        _Seed        ("Seed",         Float)  = 1
        _PlanetTime  ("Time",         Float)  = 0
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" }
        Blend SrcAlpha OneMinusSrcAlpha
        ZWrite Off Cull Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            float  _Rotation, _Size, _Seed, _PlanetTime;
            float4 _LightOrigin;
            int    _Octaves;
            float4 _Colors[3];

            struct a2v { float4 vertex:POSITION; float2 uv:TEXCOORD0; };
            struct v2f { float4 pos:SV_POSITION; float2 uv:TEXCOORD0; };

            v2f vert(a2v v) {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv  = float2(v.uv.x, 1-v.uv.y);
                return o;
            }

            // No tiling — infinite noise gives organic irregular edge
            float rand(float2 coord) {
                return frac(sin(dot(coord, float2(12.9898,78.233)))*15.5453*_Seed);
            }
            float noise(float2 coord) {
                float2 i=floor(coord), f=frac(coord);
                float a=rand(i),b=rand(i+float2(1,0)),c=rand(i+float2(0,1)),d=rand(i+float2(1,1));
                float2 cu=f*f*(3-2*f);
                return lerp(a,b,cu.x)+(c-a)*cu.y*(1-cu.x)+(d-b)*cu.x*cu.y;
            }
            float fbm(float2 coord) {
                float v=0,s=0.5;
                for(int i=0;i<_Octaves;i++){v+=noise(coord)*s;coord*=2;s*=0.5;}
                return v;
            }
            float2 glmod(float2 x, float2 y) { return x - y*floor(x/y); }
            float circleNoise(float2 uv) {
                float uy=floor(uv.y); uv.x+=uy*0.31;
                float2 f=frac(uv);
                float h=rand(float2(floor(uv.x),floor(uy)));
                float m=length(f-0.25-h*0.5);
                float r=h*0.25;
                return smoothstep(r-.10*r, r, m);
            }
            float crater(float2 uv) {
                float c=1;
                for(int i=0;i<2;i++) c *= circleNoise(uv*_Size+(float(i+1)+10.0));
                return 1-c;
            }
            float2 rot(float2 v, float a) {
                v -= 0.5; float c=cos(a),s=sin(a);
                return mul(v, float2x2(c,s,-s,c))+0.5;
            }

            fixed4 frag(v2f i) : SV_Target {
                float2 uv  = i.uv;
                float  d   = distance(uv, float2(0.5,0.5));
                float2 lo  = _LightOrigin.xy;

                uv = rot(uv, _Rotation);

                float n  = fbm(uv*_Size);
                float n2 = fbm(uv*_Size + (rot(lo,_Rotation)-0.5)*0.5);

                // Irregular rock boundary — smooth edge via fbm
                float ns   = smoothstep(0.16, 0.24, n  - d);
                float n2s  = smoothstep(0.16, 0.24, n2 - d);
                float rel  = (n2s+n2) - (ns+n);

                float c1 = crater(uv);
                float c2 = crater(uv + (lo-0.5)*0.03);

                // Toon 3-band shading
                float t_shadow = smoothstep(-0.08, -0.02, rel);
                float t_light  = smoothstep( 0.02,  0.08, rel);
                float4 col = _Colors[1];
                col = lerp(col, _Colors[0], t_shadow);
                col = lerp(col, _Colors[2], t_light);

                // Crater overlay
                if (c1 > 0.4) col = _Colors[1];
                if (c2 < c1)  col = lerp(col, _Colors[2], 0.6);

                // Smooth rock silhouette
                float alpha = smoothstep(0.14, 0.22, n-d);
                return float4(col.rgb, alpha*col.a);
            }
            ENDCG
        }
    }
}
