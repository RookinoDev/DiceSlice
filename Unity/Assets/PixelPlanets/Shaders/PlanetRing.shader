// Toon version — smooth ring shader
Shader "PixelPlanets/PlanetRing"
{
    Properties
    {
        _Rotation        ("Rotation",          Float)     = 0
        _LightOrigin     ("Light Origin",      Vector)    = (0.39,0.39,0,0)
        _TimeSpeed       ("Time Speed",        Float)     = 0.2
        _LightBorder1    ("Light Border1",     Range(0,1))= 0.52
        _LightBorder2    ("Light Border2",     Range(0,1))= 0.62
        _RingWidth       ("Ring Width",        Range(0,0.15))= 0.1
        _RingPerspective ("Ring Perspective",  Float)     = 4
        _ScaleRelPlanet  ("Scale Rel Planet",  Float)     = 6
        _Size            ("Size",              Float)     = 50
        _Octaves         ("Octaves",           Int)       = 4
        _Seed            ("Seed",              Float)     = 1
        _PlanetTime      ("Time",              Float)     = 0
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

            float  _Rotation, _TimeSpeed, _LightBorder1, _LightBorder2;
            float  _RingWidth, _RingPerspective, _ScaleRelPlanet, _Size, _Seed, _PlanetTime;
            float4 _LightOrigin;
            int    _Octaves;
            float4 _Colors[3];
            float4 _DarkColors[3];

            struct a2v { float4 vertex:POSITION; float2 uv:TEXCOORD0; };
            struct v2f { float4 pos:SV_POSITION; float2 uv:TEXCOORD0; };

            v2f vert(a2v v) {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv  = float2(v.uv.x, 1-v.uv.y);
                return o;
            }

            float2 glmod(float2 x, float2 y) { return x - y*floor(x/y); }
            float rand(float2 coord) {
                coord = glmod(coord, float2(2,1)*round(_Size));
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
            float2 rot(float2 coord, float angle) {
                coord-=0.5; float c=cos(angle),s=sin(angle);
                return mul(coord, float2x2(c,s,-s,c))+0.5;
            }

            fixed4 frag(v2f i) : SV_Target {
                float2 uv     = i.uv;
                float light_d = distance(uv, _LightOrigin.xy);
                uv = rot(uv, _Rotation);

                float2 uvc = uv - float2(0,0.5);
                uvc *= float2(1, _RingPerspective);
                float cd   = distance(uvc, float2(0.5,0));
                float ring = smoothstep(0.5-_RingWidth*2, 0.5-_RingWidth, cd);
                      ring *= smoothstep(cd-_RingWidth, cd, 0.4);

                // Planet occludes lower half of ring
                if (uv.y < 0.5)
                    ring *= smoothstep(1.0/_ScaleRelPlanet-0.01,
                                       1.0/_ScaleRelPlanet+0.01,
                                       distance(uv, float2(0.5,0.5)));

                uvc = rot(uvc + float2(0,0.5), _PlanetTime*_TimeSpeed);
                ring *= fbm(uvc*_Size);

                float post = floor((ring + pow(light_d,2)*2)*4)/4.0;
                post = clamp(post, 0, 2.0);

                float4 col;
                if (post <= 1.0)
                    col = lerp(_Colors[min(2,(int)(post*2.0))],
                               _Colors[min(2,(int)(post*2.0)+1)],
                               smoothstep(0.4,0.6,frac(post*2.0)));
                else
                    col = lerp(_DarkColors[min(2,(int)((post-1.0)*2.0))],
                               _DarkColors[min(2,(int)((post-1.0)*2.0)+1)],
                               smoothstep(0.4,0.6,frac((post-1.0)*2.0)));

                float ring_a = smoothstep(0.22, 0.32, ring);
                return float4(col.rgb, ring_a*col.a);
            }
            ENDCG
        }
    }
}
