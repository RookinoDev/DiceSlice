// Toon StarBlobs — smooth corona blobs, no pixelation
Shader "PixelPlanets/StarBlobs"
{
    Properties
    {
        _Rotation     ("Rotation",      Float)        = 0
        _TimeSpeed    ("Time Speed",    Float)        = 0.05
        _PlanetTime   ("Time",          Float)        = 0
        _CircleAmount ("Circle Amount", Range(2,30))  = 5
        _CircleSize   ("Circle Size",   Range(0,1))   = 1
        _Size         ("Size",          Float)        = 50
        _Seed         ("Seed",          Float)        = 1
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
            float  _CircleAmount, _CircleSize, _Size, _Seed;
            float4 _Colors[1];

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

            float circleFunc(float2 uv) {
                float inv = 1.0/_CircleAmount;
                if (glmod(float2(uv.y,0), float2(inv*2,0)).x < inv) uv.x += inv*0.5;
                float2 rc  = floor(uv*_CircleAmount)/_CircleAmount;
                uv = glmod(uv, float2(inv,inv))*_CircleAmount;
                float r    = rand(rc);
                r = clamp(r, inv, 1.0-inv);
                float circ = distance(uv, float2(r,r));
                return smoothstep(circ, circ+0.5, inv*_CircleSize*rand(rc*1.5));
            }

            float2 rot(float2 v, float a) {
                v -= 0.5; float c=cos(a),s=sin(a);
                return mul(v, float2x2(c,s,-s,c))+0.5;
            }

            fixed4 frag(v2f i) : SV_Target {
                float2 uv   = i.uv;
                float2 ruv  = rot(uv, _Rotation);
                float angle = atan2(ruv.x-0.5, ruv.y-0.5);
                float d     = distance(uv, float2(0.5,0.5));

                float c = 0;
                for(int k=0; k<15; k++) {
                    float r    = rand(float2(k,0));
                    float2 cuv = float2(d, angle);
                    c += circleFunc(cuv*_Size - _PlanetTime*_TimeSpeed - (1.0/max(d,0.01))*0.1 + r);
                }

                c *= 0.37 - d;
                // Smooth blob edge — no hard step, soft corona falloff
                float alpha = smoothstep(0.04, 0.10, c - d);
                float4 col  = _Colors[0];
                return float4(col.rgb, alpha*col.a);
            }
            ENDCG
        }
    }
}
