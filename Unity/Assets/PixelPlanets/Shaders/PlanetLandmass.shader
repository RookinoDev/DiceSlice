// Toon version — smooth cel-shaded land layer
Shader "PixelPlanets/PlanetLandmass"
{
    Properties
    {
        _Rotation     ("Rotation",      Float)     = 0
        _LightOrigin  ("Light Origin",  Vector)    = (0.39,0.39,0,0)
        _TimeSpeed    ("Time Speed",    Float)     = 0.2
        _LightBorder1 ("Light Border1", Range(0,1))= 0.4
        _LightBorder2 ("Light Border2", Range(0,1))= 0.5
        _LandCutoff   ("Land Cutoff",   Range(0,1))= 0.4
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

            float  _Rotation, _TimeSpeed, _LightBorder1, _LightBorder2, _LandCutoff;
            float4 _LightOrigin;
            float  _Size, _Seed, _PlanetTime;
            int    _Octaves;
            float4 _Colors[4];

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

                uv = rot(uv, _Rotation);
                uv = spherify(uv);

                float2 base = uv*_Size + float2(_PlanetTime*_TimeSpeed, 0);
                float2 lo   = _LightOrigin.xy;
                float f1 = fbm(base);
                float f2 = fbm(base - lo*f1);
                float f3 = fbm(base - lo*1.5*f1);
                float f4 = fbm(base - lo*2.0*f1);

                // Light influence
                if (d_light < _LightBorder1) f4 *= 0.9;
                if (d_light > _LightBorder1) { f2*=1.05; f3*=1.05; f4*=1.05; }
                if (d_light > _LightBorder2) { f2*=1.3;  f3*=1.4;  f4*=1.8; }
                float dl = pow(d_light,2)*0.1;

                // Smooth toon: narrow band transitions
                float4 col = _Colors[3];
                col = lerp(col, _Colors[2], smoothstep(f1-dl-0.02, f1-dl+0.02, f4));
                col = lerp(col, _Colors[1], smoothstep(f1-dl-0.02, f1-dl+0.02, f3));
                col = lerp(col, _Colors[0], smoothstep(f1-dl-0.02, f1-dl+0.02, f2));

                float landAlpha = smoothstep(_LandCutoff-0.04, _LandCutoff+0.04, f1);
                return float4(col.rgb, landAlpha*a*col.a);
            }
            ENDCG
        }
    }
}
