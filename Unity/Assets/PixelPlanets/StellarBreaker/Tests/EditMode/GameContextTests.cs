using NUnit.Framework;
using StellarBreaker.Core;

namespace StellarBreaker.Tests
{
    public class GameContextTests
    {
        class FooService { public int Value; }

        [SetUp]
        public void SetUp() => GameContext.Clear();

        [TearDown]
        public void TearDown() => GameContext.Clear();

        [Test]
        public void Register_Then_Get_Returns_Same_Instance()
        {
            var foo = new FooService { Value = 7 };
            GameContext.Register(foo);
            Assert.AreSame(foo, GameContext.Get<FooService>());
            Assert.AreEqual(7, GameContext.Get<FooService>().Value);
        }

        [Test]
        public void Get_Unregistered_Returns_Null()
        {
            Assert.IsNull(GameContext.Get<FooService>());
            Assert.IsFalse(GameContext.Has<FooService>());
        }

        [Test]
        public void TryGet_Reports_Presence()
        {
            Assert.IsFalse(GameContext.TryGet<FooService>(out _));
            GameContext.Register(new FooService());
            Assert.IsTrue(GameContext.TryGet<FooService>(out var svc));
            Assert.IsNotNull(svc);
        }

        [Test]
        public void Clear_And_Unregister_Remove_Services()
        {
            GameContext.Register(new FooService());
            GameContext.Unregister<FooService>();
            Assert.IsFalse(GameContext.Has<FooService>());

            GameContext.Register(new FooService());
            GameContext.Clear();
            Assert.IsFalse(GameContext.Has<FooService>());
        }
    }
}
