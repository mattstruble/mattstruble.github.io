function loadClapCount() {
	var elements = $(".clap").toArray();
	var urls = elements.map(function (el) {
		return el.getAttribute("data-url")
	});
	
	$.ajax({
		url: "https://api.applause-button.com/get-multiple",
		method: "POST",
		data: JSON.stringify(urls),
		headers: {"Content-Type": "text/plain"},
		contentType: "text/plain"
	}).done(function (claps) {
		$(".clap").each(function () {
			var elem = $(this);
			var	url = elem.attr("data-url").replace(/^https?:\/\//, "");
			var clapCount = claps.find(function (c) {return c.url === url});
			if (clapCount && clapCount.claps > 0) {
				elem.css("display", "initial").find(".count").html(clapCount.claps)
			}
		})
	})
}

function updateClap(clapCount) {
	$('.clap').css({color: "#007bff", fill: "#007bff"}).find('.count').html(clapCount);
	$('#applause-button').find('.count').html(clapCount);
}

function getClap() {
	return Number($('.clap').find('.count').html());
}

function hideOverfill(elem) {
	if ( elem.offset().left-20< 0 ){
	  elem.addClass('hidden');
	  elem.children().addClass('none');
	} else {
	  elem.removeClass('hidden');
	  elem.children().removeClass('none');
	}
}

$(document).ready(function () {
	loadClapCount();
	

	$('#applause-button').on("clapped", function(event) {
	  updateClap(event.detail.clapCount);
	});

	var applauseWrapper = $('.applause-button-wrapper');
	var applauseTop = applauseWrapper.offset().top;

	$(window).scroll(function() {
		 var scrollPos = $(document).scrollTop();
		 if ( scrollPos > applauseTop-30) {
			applauseWrapper.addClass('applause-button-fixed');
		 } else {
			 applauseWrapper.removeClass('applause-button-fixed');
		 }
	});

	hideOverfill(applauseWrapper);
	$(window).resize(function() {
		hideOverfill(applauseWrapper);
	});

	$('.share-page .clap').click(function (event) {
		$.ajax({
			url: "https://api.applause-button.com/update-claps?url=" + window.location,
			method: "POST",
			headers: {"Content-Type": "text/plain"},
			contentType: "text/plain"
		}).done(function (claps) {
			updateClap(getClap()+1);
		});
	});
});