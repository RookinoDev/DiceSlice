// Toon StarFlares — smooth flare/storm, no pixelation
Shader "PixelPlanets/StarFlares"
{
    Properties
    {
        _Rotation     ("Rotation",       Float)        = 0
        _TimeSpeed    ("Time Speed",     Float)        = 0.05
        _PlanetTime   ("Time",           Float)        = 0
        _StormWidth   ("Storm Width",    Range(0,0.5)) = 0.3
        _Scale        ("Scale",          Float)        = 1
        _CircleAmount ("Circle Amount",  Range(2,30))  = 5
        _CircleScale  ("Circle Scale",   Range(0,1))   = 1
        _Size         ("Size",           Float)        = 50
        _Octaves      ("Octaves",        Int)          = 4
        _Seed         ("Seed",           Float)        = 1
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

            float  _Rotation, _TimeSpeed, _PlanetTime;
            float  _StormWidth, _Scale, _CircleAmount, _CircleScale, _Size, _Seed;
            int    _Octaves;
            float4 _Colors[2];

            struct a2v { float4 vertex:POSITION; float2 uv:TEXCOORD0; };
            struct v2f { float4 pos:SV_POSITION; float2 uv:TEXCOORD0; };

            v2f vert(a2v v) {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv  = float2(v.uv.x, 1-v.uv.y);
                return o;
            }

            float2 glmod(float2 x, float2 y) { return x - y*floor(x/y); }
            float rand(float2 co) {
                co = glmod(co, float2(1,1)*round(_Size));
                return frac(sin(dot(co, float2(12.9898,78.233)))*15.5453*_Seed);
            }
            float noise(float2 coord) {
                float2 ii=floor(coord), f=frac(coord);
                float a=rand(ii),b=rand(ii+float2(1,0)),c=rand(ii+float2(0,1)),d=rand(ii+float2(1,1));
                float2 cu=f*f*(3-2*f);
                return lerp(a,b,cu.x)+(c-a)*cu.y*(1-cu.x)+(d-b)*cu.x*cu.y;
            }
            float fbm(float2 coord) {
                float v=0,s=0.5;
                for(int i=0;i<_Octaves;i++){v+=noise(coord)*s;coord*=2;s*=0.5;}
                return v;
            }
            float circleFunc(float2 uv) {
                float inv = 1.0/_CircleAmount;
                if (glmod(float2(uv.y,0), float2(inv*2,0)).x < inv) uv.x += inv*0.5;
                float2 rc  = floor(uv*_CircleAmount)/_CircleAmount;
                uv = glmod(uv, float2(inv,inv))*_CircleAmount;
                float r    = rand(rc);
                r = clamp(r, inv, 1.0-inv);
                float circ = distance(uv, float2(r,r));
                return smoothstep(circ, circ+0.5, inv*_CircleScale*rand(rc*1.5));
            }

            float2 rot(float2 v, float a) {
                v -= 0.5; float c=cos(a),s=sin(a);
                return mul(v, float2x2(c,s,-s,c))+0.5;
            }

            fixed4 frag(v2f i) : SV_Target {
                float2 uv   = i.uv;
                float2 ruv  = rot(uv, _Rotation);
                float angle = atan2(ruv.x-0.5, ruv.y-0.5)*0.4;
                float d     = distance(uv, float2(0.5,0.5));

                float2 cuv = float2(d, angle);
                float  n   = fbm(cuv*_Size - _PlanetTime*_TimeSpeed);
                float  nc  = circleFunc(cuv*_Scale - _PlanetTime*_TimeSpeed + n);
                nc *= 1.5;
                float n2 = fbm(cuv*_Size - _PlanetTime + float2(100,100));
                nc -= n2*0.1;

                // Smooth flare edge — soft gradient falloff instead of hard step
                float inner = _StormWidth + d;
                float alpha = smoothstep(inner-0.06, inner+0.06, nc)
                            * smoothstep(1.0, 0.85, d)           // fade at outer edge
                            * smoothstep(n2*0.25-0.02, n2*0.25+0.02, d);

                int   idx = clamp((int)floor(n2+nc), 0, 1);
                float4 col = _Colors[idx];
                return float4(col.rgb, alpha*col.a);
            }
            ENDCG
        }
    }
}
