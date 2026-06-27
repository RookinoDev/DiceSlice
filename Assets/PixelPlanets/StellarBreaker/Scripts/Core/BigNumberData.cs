using System;

namespace StellarBreaker.Core
{
    /// <summary>JSON-serializable form of a BigNumber (public fields for JsonUtility).</summary>
    [Serializable]
    public struct BigNumberData
    {
        public double mantissa;
        public int    exponent;

        public BigNumberData(BigNumber b) { mantissa = b.Mantissa; exponent = b.Exponent; }
        public BigNumber To() => new BigNumber(mantissa, exponent);
        public static BigNumberData From(BigNumber b) => new BigNumberData(b);
    }
}
