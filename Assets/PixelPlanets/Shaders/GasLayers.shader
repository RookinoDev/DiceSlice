// Toon version — smooth gas giant bands
Shader "PixelPlanets/GasLayers"
{
    Properties
    {
        _Rotation     ("Rotation",      Float)     = 0
        _CloudCover   ("Cloud Cover",   Range(0,1))= 0.4
        _LightOrigin  ("Light Origin",  Vector)    = (0.39,0.39,0,0)
        _TimeSpeed    ("Time Speed",    Float)     = 0.2
        _Stretch      ("Stretch",       Range(1,3))= 2
        _CloudCurve   ("Cloud Curve",   Range(1,2))= 1.3
        _LightBorder1 ("Light Border1", Range(0,1))= 0.52
        _LightBorder2 ("Light Border2", Range(0,1))= 0.62
        _Bands        ("Bands",         Float)     = 1
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

            float  _Rotation, _CloudCover, _TimeSpeed, _Stretch, _CloudCurve;
            float  _LightBorder1, _LightBorder2, _Bands, _Size, _Seed, _PlanetTime;
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
            float circleNoise(float2 uv) {
                float uy=floor(uv.y); uv.x+=uy*0.31;
                float2 f=frac(uv);
                float h=rand(float2(floor(uv.x),floor(uy)));
                float m=length(f-0.25-h*0.5); float r=h*0.25;
                return smoothstep(0,r,m*0.75);
            }
            float turbulence(float2 uv) {
                float2 scroll=float2(_PlanetTime*_TimeSpeed,0);
                float cn=0;
                // Reduced iterations + larger scale for smooth turbulence
                cn += circleNoise(uv*_Size*0.12 + 10.0 + scroll);
                cn += circleNoise(uv*_Size*0.08 + 20.0 + scroll)*0.5;
                cn += circleNoise(uv*_Size*0.05 + 30.0 + scroll)*0.25;
                return cn;
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
                float a        = 1.0 - smoothstep(0.487, 0.5, d_circle);
                float light_d  = distance(uv, _LightOrigin.xy);

                uv = rot(uv, _Rotation);
                uv = spherify(uv);

                // _Stretch elongates turbulence patterns horizontally (classic gas giant look)
                float2 suv = float2(uv.x * _Stretch, uv.y);
                float band = fbm(float2(0, uv.y*_Size*_Bands));
                float turb = turbulence(suv);
                float f1   = fbm(suv*_Size);
                float f2   = fbm(suv*float2(1,2)*_Size + f1 + float2(-_PlanetTime*_TimeSpeed,0) + turb);
                f2 *= pow(band,2)*7.0;
                float light = f2 + light_d*1.8;
                f2 += pow(light_d,1.0)-0.3;
                f2  = smoothstep(-0.2, 4.0-f2, light);

                // Toon posterization: 4 smooth bands
                float post = floor(f2*4.0)/2.0;
                post = clamp(post, 0, 2.0);

                // _CloudCover shifts light/dark band boundary
                float4 col;
                if (f2 < _CloudCover) {
                    int idx = clamp((int)(post*2.0), 0, 2);
                    float blend = frac(post*2.0);
                    col = lerp(_Colors[idx], _Colors[min(idx+1,2)],
                               smoothstep(0.4, 0.6, blend));
                } else {
                    float pp = clamp((post-1.0)*2.0, 0, 1.99);
                    int idx = clamp((int)pp, 0, 2);
                    float blend = frac(pp);
                    col = lerp(_DarkColors[idx], _DarkColors[min(idx+1,2)],
                               smoothstep(0.4, 0.6, blend));
                }
                return float4(col.rgb, a*col.a);
            }
            ENDCG
        }
    }
}
