// Toon version — smooth cel-shaded water/base layer
Shader "PixelPlanets/PlanetUnder"
{
    Properties
    {
        _Rotation     ("Rotation",      Float)     = 0
        _LightOrigin  ("Light Origin",  Vector)    = (0.39,0.39,0,0)
        _TimeSpeed    ("Time Speed",    Float)     = 0.2
        _LightBorder1 ("Light Border1", Range(0,1))= 0.4
        _LightBorder2 ("Light Border2", Range(0,1))= 0.6
        _Size         ("Size",          Float)     = 50
        _Octaves      ("Octaves",       Int)       = 4
        _Seed         ("Seed",          Float)     = 1
        _PlanetTime   ("Time",          Float)     = 0
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
            float4 _LightOrigin;
            float  _Size, _Seed, _PlanetTime;
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
            float2 spherify(float2 uv) {
                float2 c=uv*2-1;
                float z=sqrt(max(0,1-dot(c,c)));
                return (c/(z+1))*0.5+0.5;
            }
            float2 rot(float2 coord, float angle) {
                coord-=0.5; float c=cos(angle),s=sin(angle);
                return mul(coord, float2x2(c,s,-s,c))+0.5;
            }

            fixed4 frag(v2f i) : SV_Target {
                float2 uv     = i.uv;
                float d_circle = distance(uv, float2(0.5,0.5));
                float a       = 1.0 - smoothstep(0.487, 0.5, d_circle);
                float d_light = distance(uv, _LightOrigin.xy);

                uv = spherify(uv);
                uv = rot(uv, _Rotation);
                d_light += fbm(uv*_Size + float2(_PlanetTime*_TimeSpeed,0))*0.3;

                // Toon: narrow smoothstep at each band boundary
                float t1 = smoothstep(_LightBorder1-0.025, _LightBorder1+0.025, d_light);
                float t2 = smoothstep(_LightBorder2-0.025, _LightBorder2+0.025, d_light);
                float4 col = lerp(_Colors[0], _Colors[1], t1);
                col        = lerp(col,        _Colors[2], t2);
                return float4(col.rgb, a*col.a);
            }
            ENDCG
        }
    }
}
